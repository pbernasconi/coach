import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The PREVIOUS column, "Last time" in the editor and "Apply to later sets". Made-up sessions only (TEST-8), a fake
/// history repository, no sleeps (TEST-3).
@MainActor
@Suite struct WorkoutHistoryTests {
    let current = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
    let lastWeekDay = Fixtures.monday.adding(days: -7)

    func makeViewModel(
        _ detail: SessionDetail,
        history: FakeExerciseHistoryRepository,
        sets: RecordingSetRepository? = nil
    ) -> WorkoutViewModel {
        WorkoutViewModel(
            sessionID: detail.id,
            sessions: FakeSessionDetailRepository(emissions: [detail]),
            sets: sets ?? RecordingSetRepository(result: detail.items[0].sets[0]),
            templates: FakeTemplateRepository(),
            router: RecordingNavigator(),
            clock: ImmediateClock(),
            restActivity: RecordingRestActivityController(),
            catalog: FakeExerciseCatalog(),
            history: history,
            health: RecordingHealthRecorder(),
            gym: InMemoryGymSettings(.standard),
            preferences: InMemoryWorkoutSettings(),
            events: RecordingWorkoutEvents(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
    }

    /// A history entry for a session of Back squat on `day` whose logged sets hold `reps` at `kg`.
    func entry(id: UInt64, on day: LocalDay, reps: [Int], kg: Double, note: String? = nil) -> ExerciseHistoryEntry {
        var detail = SessionBuilder.session(id: id, on: day, done: reps.count, planned: 0)
        for (index, value) in reps.enumerated() {
            detail.items[0].sets[index].actualReps = value
            detail.items[0].sets[index].actualWeight = .kg(kg)
        }
        return ExerciseHistoryEntry(session: detail.session, loadMode: .total, sets: detail.items[0].sets, note: note)
    }

    func firstExercise(_ vm: WorkoutViewModel) -> WorkoutExercise? {
        guard case .loaded(let workout) = vm.state.workout else { return nil }
        return workout.exercises.first
    }

    func rows(_ vm: WorkoutViewModel) -> [WorkoutSetItem] {
        guard case .loaded(let workout) = vm.state.workout else { return [] }
        return workout.exercises.first?.sets ?? []
    }

    @Test func runFillsPreviousFromTheLatestEarlierSessionOnly() async {
        let history = FakeExerciseHistoryRepository(emissions: [
            [
                entry(id: 3, on: Fixtures.monday.adding(days: 7), reps: [9, 9, 9], kg: 120),
                entry(id: 1, on: Fixtures.monday, reps: [7, 7, 7], kg: 110),
                entry(id: 2, on: lastWeekDay, reps: [5, 4, 3], kg: 95),
                entry(id: 4, on: Fixtures.monday.adding(days: -14), reps: [5, 5, 5], kg: 90),
            ]
        ])
        let vm = makeViewModel(current, history: history)

        await vm.run()

        #expect(history.requested == [.init(exerciseID: Fixtures.squat.id, limit: PreviousSetsLoader.historyLimit)])
        #expect(rows(vm).map(\.previous) == ["5 × 95", "4 × 95", "3 × 95"])
        #expect(vm.state.previous[Fixtures.squat.id]?.day == lastWeekDay)
        #expect(rows(vm).map(\.badge) == ["1", "2", "3"])
        #expect(rows(vm).map(\.weight) == ["100", "100", "100"])
        #expect(rows(vm).map(\.reps) == ["5", "5", "5"])
    }

    @Test func runLeavesPreviousEmptyWithoutAnEarlierSession() async {
        let history = FakeExerciseHistoryRepository(emissions: [
            [entry(id: 1, on: Fixtures.monday, reps: [5], kg: 100)]
        ])
        let vm = makeViewModel(current, history: history)

        await vm.run()

        #expect(rows(vm).map(\.previous) == [nil, nil, nil])
        #expect(vm.state.previous.isEmpty)
    }

    @Test func runMatchesPreviousSetsByPositionWithinTheirKind() async {
        var detail = current
        detail.items[0].sets[0].kind = .warmUp
        detail.items[0].sets[0].target = SetTarget(reps: 5, weight: .kg(60))
        let history = FakeExerciseHistoryRepository(emissions: [
            [entry(id: 2, on: lastWeekDay, reps: [5, 4, 3], kg: 95)]
        ])
        let vm = makeViewModel(detail, history: history)

        await vm.run()

        #expect(rows(vm).map(\.badge) == ["W", "1", "2"])
        #expect(rows(vm).map(\.previous) == [nil, "5 × 95", "4 × 95"])
        #expect(rows(vm).first?.weight == "60")
    }

    @Test func setValuesTappedShowsLastTimeAndTheLaterSets() async {
        let history = FakeExerciseHistoryRepository(emissions: [
            [entry(id: 2, on: lastWeekDay, reps: [5, 4, 3], kg: 95)]
        ])
        let vm = makeViewModel(current, history: history)
        await vm.run()

        vm.send(.setValuesTapped(current.items[0].sets[1].id))

        let day = DayCalendar(calendar: SessionBuilder.calendar).shortTitle(of: lastWeekDay)
        #expect(vm.state.editor?.lastTime == "Last time 4 × 95 kg · \(day)")
        #expect(vm.state.editor?.laterSets == 1)
        #expect(vm.state.editor?.appliesToLater == true)
    }

    @Test func editorDoneTappedAppliesTheNewWeightToLaterPlannedSetsAndNeverLogs() async {
        var detail = current
        detail.items[0].sets[1].actualReps = 6
        let sets = RecordingSetRepository(result: detail.items[0].sets[0])
        let vm = makeViewModel(detail, history: FakeExerciseHistoryRepository(emissions: [[]]), sets: sets)
        await vm.run()
        let ids = detail.items[0].sets.map(\.id)
        vm.send(.setValuesTapped(ids[0]))
        vm.send(.editorWeightChanged(102.5))

        await vm.send(.editorDoneTapped)?.value

        #expect(
            sets.calls == [
                .saveValues(setID: ids[0], reps: 5, weight: .kg(102.5)),
                .saveValues(setID: ids[1], reps: 6, weight: .kg(102.5)),
                .saveValues(setID: ids[2], reps: nil, weight: .kg(102.5)),
            ]
        )
        #expect(!sets.calls.contains { if case .log = $0 { true } else { false } })
    }

    @Test func editorDoneTappedAppliesNewRepsToLaterPlannedSetsKeepingTheirWeight() async {
        var detail = current
        detail.items[0].sets[2].actualWeight = .kg(110)
        let sets = RecordingSetRepository(result: detail.items[0].sets[0])
        let vm = makeViewModel(detail, history: FakeExerciseHistoryRepository(emissions: [[]]), sets: sets)
        await vm.run()
        let ids = detail.items[0].sets.map(\.id)
        vm.send(.setValuesTapped(ids[0]))
        vm.send(.editorRepsChanged(8))

        await vm.send(.editorDoneTapped)?.value

        #expect(
            sets.calls == [
                .saveValues(setID: ids[0], reps: 8, weight: .kg(100)),
                .saveValues(setID: ids[1], reps: 8, weight: nil),
                .saveValues(setID: ids[2], reps: 8, weight: .kg(110)),
            ]
        )
    }

    @Test func editorDoneTappedSkipsLoggedLaterSetsAndUnchangedValues() async {
        var detail = current
        detail.items[0].sets[2].status = .done
        let sets = RecordingSetRepository(result: detail.items[0].sets[0])
        let vm = makeViewModel(detail, history: FakeExerciseHistoryRepository(emissions: [[]]), sets: sets)
        await vm.run()
        let ids = detail.items[0].sets.map(\.id)

        vm.send(.setValuesTapped(ids[0]))
        vm.send(.editorRepsChanged(6))
        await vm.send(.editorDoneTapped)?.value
        vm.send(.setValuesTapped(ids[0]))
        vm.send(.editorWeightChanged(105))
        await vm.send(.editorDoneTapped)?.value

        #expect(
            sets.calls == [
                .saveValues(setID: ids[0], reps: 6, weight: .kg(100)),
                .saveValues(setID: ids[1], reps: 6, weight: nil),
                .saveValues(setID: ids[0], reps: 5, weight: .kg(105)),
                .saveValues(setID: ids[1], reps: nil, weight: .kg(105)),
            ]
        )
    }

    @Test func editorDoneTappedWithApplyOffSavesOnlyTheEditedSet() async {
        let sets = RecordingSetRepository(result: current.items[0].sets[0])
        let vm = makeViewModel(current, history: FakeExerciseHistoryRepository(emissions: [[]]), sets: sets)
        await vm.run()
        let first = current.items[0].sets[0].id
        vm.send(.setValuesTapped(first))
        vm.send(.editorWeightChanged(105))
        vm.send(.editorApplyToLaterChanged(false))

        await vm.send(.editorDoneTapped)?.value

        #expect(sets.calls == [.saveValues(setID: first, reps: 5, weight: .kg(105))])
    }
}
