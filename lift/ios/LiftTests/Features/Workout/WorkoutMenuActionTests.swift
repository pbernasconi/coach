import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The workout menu's Actions: pause and resume, the reorder sheet and Workout settings. One test per Action case
/// (TEST-2); writes are awaited through `send(...)?.value` (TEST-3).
@MainActor
@Suite struct WorkoutMenuActionTests {
    /// A started session with two exercises: the builder's squat, then a bench press.
    func detail(pausedAt: Date? = nil) -> SessionDetail {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 2)
        detail.session.startedAt = ManualNow.start
        detail.session.pausedAt = pausedAt
        let bench = SessionExerciseRecord(
            id: IDSequence.id(2, prefix: 0xB0),
            sessionID: detail.id,
            slot: ExerciseSlot(exercise: Fixtures.dumbbellBench),
            position: 1,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        detail.items.append(SessionDetail.Item(exercise: bench, sets: []))
        return detail
    }

    func loaded(
        _ detail: SessionDetail,
        preferences: InMemoryWorkoutSettings = InMemoryWorkoutSettings()
    ) async -> (WorkoutViewModel, FakeSessionDetailRepository) {
        let sessions = FakeSessionDetailRepository(emissions: [detail])
        let vm = WorkoutViewModel(
            sessionID: detail.id,
            sessions: sessions,
            sets: RecordingSetRepository(result: detail.items[0].sets[0]),
            templates: FakeTemplateRepository(),
            router: RecordingNavigator(),
            clock: ImmediateClock(),
            restActivity: RecordingRestActivityController(),
            catalog: FakeExerciseCatalog(),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: RecordingHealthRecorder(),
            gym: InMemoryGymSettings(.standard),
            preferences: preferences,
            events: RecordingWorkoutEvents(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return (vm, sessions)
    }

    @Test func pauseTappedPausesTheWorkout() async {
        let detail = detail()
        let (vm, sessions) = await loaded(detail)
        vm.send(.workoutOptionsTapped)

        await vm.send(.pauseTapped)?.value

        #expect(sessions.calls == [.changeTime(detail.id, .pause)])
        #expect(vm.state.options == nil)
        #expect(vm.state.rest == nil)
    }

    @Test func resumeTappedResumesTheWorkout() async {
        let detail = detail(pausedAt: ManualNow.start)
        let (vm, sessions) = await loaded(detail)

        await vm.send(.resumeTapped)?.value

        #expect(sessions.calls == [.changeTime(detail.id, .resume)])
    }

    @Test func loggingASetWhilePausedResumesFirst() async {
        let detail = detail(pausedAt: ManualNow.start)
        let (vm, sessions) = await loaded(detail)

        await vm.send(.setLogTapped(detail.items[0].sets[0].id))?.value

        #expect(sessions.calls == [.changeTime(detail.id, .resume)])
    }

    @Test func reorderTappedOpensTheExercisesInOrder() async {
        let detail = detail()
        let (vm, _) = await loaded(detail)

        vm.send(.reorderTapped)

        #expect(vm.state.reorder?.ids == detail.items.map(\.id))
        #expect(vm.state.reorder?.hasChanges == false)

        #expect(vm.state.reorder?.rows.first?.detail == "2 sets")
    }

    @Test func reorderMovedMovesTheRow() async {
        let detail = detail()
        let (vm, _) = await loaded(detail)
        vm.send(.reorderTapped)

        vm.send(.reorderMoved(from: IndexSet(integer: 1), to: 0))

        #expect(vm.state.reorder?.ids == [detail.items[1].id, detail.items[0].id])
        #expect(vm.state.reorder?.hasChanges == true)
    }

    @Test func reorderDoneTappedSavesTheNewOrderAndCloses() async {
        let detail = detail()
        let (vm, sessions) = await loaded(detail)
        vm.send(.reorderTapped)
        vm.send(.reorderMoved(from: IndexSet(integer: 0), to: 2))

        await vm.send(.reorderDoneTapped)?.value

        #expect(sessions.calls == [.reorder(detail.id, [detail.items[1].id, detail.items[0].id])])
        #expect(vm.state.reorder == nil)
    }

    @Test func reorderDismissedWritesNothing() async {
        let detail = detail()
        let (vm, sessions) = await loaded(detail)
        vm.send(.reorderTapped)
        vm.send(.reorderMoved(from: IndexSet(integer: 0), to: 2))

        vm.send(.reorderDismissed)

        #expect(sessions.calls.isEmpty)
        #expect(vm.state.reorder == nil)
    }

    @Test func settingsTappedOpensWithTheWorkoutAndDefaults() async {
        let saved = WorkoutPreferences.with { $0.defaultRestSeconds = 120 }
        let (vm, _) = await loaded(detail(), preferences: InMemoryWorkoutSettings(saved))

        vm.send(.settingsTapped)

        #expect(vm.state.settings?.title == "Lower A")
        #expect(vm.state.settings?.startedAt == ManualNow.start)
        #expect(vm.state.settings?.preferences == saved)
    }

    @Test func settingsDoneTappedRenamesTheWorkout() async {
        let detail = detail()
        let (vm, sessions) = await loaded(detail)
        vm.send(.settingsTapped)
        vm.send(.settingsTitleChanged("Legs"))

        await vm.send(.settingsDoneTapped)?.value

        #expect(sessions.calls == [.rename(detail.id, "Legs")])
        #expect(vm.state.settings == nil)
    }

    @Test func settingsDismissedKeepsTheName() async {
        let (vm, sessions) = await loaded(detail())
        vm.send(.settingsTapped)
        vm.send(.settingsTitleChanged("Legs"))

        vm.send(.settingsDismissed)

        #expect(sessions.calls.isEmpty)
        #expect(vm.state.settings == nil)
    }

    @Test func settingsStartChangedMovesTheStart() async {
        let detail = detail()
        let (vm, sessions) = await loaded(detail)
        vm.send(.settingsTapped)
        let earlier = ManualNow.start.addingTimeInterval(-600)

        await vm.send(.settingsStartChanged(earlier))?.value

        #expect(sessions.calls == [.changeTime(detail.id, .start(at: earlier))])
        #expect(vm.state.settings?.startedAt == earlier)
    }

    @Test func settingsPreferencesChangedSavesTheDefaults() async {
        let store = InMemoryWorkoutSettings()
        let (vm, _) = await loaded(detail(), preferences: store)
        vm.send(.settingsTapped)
        let changed = WorkoutPreferences.with { $0.restAlert = .off }

        vm.send(.settingsPreferencesChanged(changed))

        #expect(store.preferences == changed)
        #expect(vm.state.preferences == changed)
        #expect(vm.state.playsRestHaptics == false)
    }

    @Test func noRestStartsWhenWorkoutSettingsTurnItOff() async {
        let detail = detail()
        let store = InMemoryWorkoutSettings(WorkoutPreferences.with { $0.startsRest = false })
        let (vm, _) = await loaded(detail, preferences: store)

        await vm.send(.setLogTapped(detail.items[0].sets[0].id))?.value

        #expect(vm.state.rest == nil)
    }
}

extension WorkoutPreferences {
    /// The defaults with `change` applied.
    static func with(_ change: (inout WorkoutPreferences) -> Void) -> WorkoutPreferences {
        var preferences = WorkoutPreferences()
        change(&preferences)
        return preferences
    }
}
