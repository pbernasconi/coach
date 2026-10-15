import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// `WorkoutViewModel.run()` and the hint lines it builds from the LiftCore rules. Made-up sessions only (TEST-8).
@MainActor
@Suite struct WorkoutRunTests {
    func run(_ emissions: [SessionDetail?]) async -> (WorkoutViewModel, FakeSessionDetailRepository) {
        let repository = FakeSessionDetailRepository(emissions: emissions)
        let vm = WorkoutViewModel(
            sessionID: IDSequence.id(1, prefix: 0xA0),
            sessions: repository,
            sets: RecordingSetRepository(
                result: SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 1)
                    .items[0].sets[0]
            ),
            router: RecordingNavigator(),
            clock: ImmediateClock(),
            restActivity: RecordingRestActivityController(),
            catalog: FakeExerciseCatalog(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return (vm, repository)
    }

    func exercise(_ vm: WorkoutViewModel) -> WorkoutExercise? {
        guard case .loaded(let workout) = vm.state.workout else { return nil }
        return workout.exercises.first
    }

    @Test func runShowsTheSessionWithPlainHints() async {
        let started = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 2)

        let (vm, repository) = await run([started])

        #expect(repository.requestedIDs == [started.id])
        guard case .loaded(let workout) = vm.state.workout, let exercise = workout.exercises.first else {
            Issue.record("Expected a loaded workout, got \(vm.state.workout)")
            return
        }
        #expect(workout.title == "Lower A")
        #expect(workout.dayTitle == DayCalendar(calendar: SessionBuilder.calendar).longTitle(of: Fixtures.monday))
        #expect(workout.loggedSets == 1)
        #expect(workout.totalSets == 3)
        #expect(exercise.name == "Back squat")
        #expect(exercise.target == "3 × 5 @ 100 kg")
        #expect(exercise.warmUp == "Warm-up: 20×10 · 50×5 · 70×3 · 85×1 kg")
        #expect(exercise.plates == "Per side: 25 + 15 · 20 kg bar")
        #expect(exercise.progression == nil)
        #expect(exercise.sets.map(\.title) == ["Set 1", "Set 2", "Set 3"])
        #expect(exercise.sets.map(\.target) == ["5 @ 100 kg", "5 @ 100 kg", "5 @ 100 kg"])
        #expect(exercise.sets.map(\.status) == [.done, .planned, .planned])
    }

    @Test func runShowsEmptyOnceTheSessionIsGone() async {
        let planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)

        let (vm, _) = await run([planned, nil])

        #expect(vm.state.workout == .empty)
    }

    @Test func runSuggestsTheNextTargetOnceEveryWorkingSetIsLogged() async {
        var done = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 3, planned: 0)
        for index in done.items[0].sets.indices {
            done.items[0].sets[index].actualReps = 5
            done.items[0].sets[index].actualWeight = .kg(100)
        }

        let (vm, _) = await run([done])

        #expect(exercise(vm)?.progression == "Next time: 5 @ 102.5 kg")
        #expect(exercise(vm)?.sets.first?.actual == "5 @ 100 kg")
    }

    @Test func runShowsSavedValuesAndPlatesThatCannotBeMadeExactly() async {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 1)
        detail.items[0].sets[0].target = SetTarget(reps: 8, weight: .kg(61))
        detail.items[0].sets[0].actualReps = 6

        let (vm, _) = await run([detail])

        #expect(exercise(vm)?.plates == "Per side: 20 · 20 kg bar = 60 kg")
        #expect(exercise(vm)?.sets.first?.actual == "6")
        #expect(exercise(vm)?.sets.first?.status == .planned)
    }

    @Test func runLeavesWarmUpAndPlatesOffForNonBarbellLifts() async {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 2)
        detail.items[0].exercise.equipment = .dumbbell

        let (vm, _) = await run([detail])

        #expect(exercise(vm)?.warmUp == nil)
        #expect(exercise(vm)?.plates == nil)
        #expect(exercise(vm)?.target == "2 × 5 @ 100 kg")
    }
}
