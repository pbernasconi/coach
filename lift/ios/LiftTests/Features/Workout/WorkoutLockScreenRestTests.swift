import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The in-app rest bar follows the Live Activity's +30s and Skip, which change the shared rest while Lift is in the
/// background (`RecordingRestActivityController.lockScreenExtend` and `lockScreenSkip`). A manual wall clock and a
/// clock that never really sleeps (TEST-3); made-up sessions only (TEST-8).
@MainActor
@Suite struct WorkoutLockScreenRestTests {
    let planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
    let activity = RecordingRestActivityController()
    let now = ManualNow()
    let clock = ImmediateClock()
    let events = RecordingWorkoutEvents()

    func makeViewModel() -> WorkoutViewModel {
        WorkoutViewModel(
            sessionID: planned.id,
            sessions: FakeSessionDetailRepository(emissions: [planned]),
            sets: RecordingSetRepository(result: planned.items[0].sets[0]),
            templates: FakeTemplateRepository(),
            router: RecordingNavigator(),
            clock: clock,
            restActivity: activity,
            catalog: FakeExerciseCatalog(),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: RecordingHealthRecorder(),
            gym: InMemoryGymSettings(.standard),
            preferences: InMemoryWorkoutSettings(),
            events: events,
            now: { [now] in now() },
            calendar: SessionBuilder.calendar
        )
    }

    /// A view model that has logged the first set, so a 90 s rest is running.
    func resting() async -> WorkoutViewModel {
        let vm = makeViewModel()
        await vm.run()
        await vm.send(.setLogTapped(planned.items[0].sets[0].id))?.value
        return vm
    }

    @Test func timeAddedOnTheLockScreenShowsInTheApp() async {
        let vm = await resting()
        now.advance(seconds: 10)
        activity.lockScreenExtend(at: now())

        await vm.runRestTimer()

        #expect(clock.sleepCount == 1 + 110)  // the first tick finds 80 + 30 s left on the wall clock
        #expect(vm.state.rest == nil)
    }

    @Test func skipOnTheLockScreenEndsTheRestBarOnTheNextTick() async {
        let vm = await resting()
        activity.lockScreenSkip()

        await vm.runRestTimer()

        #expect(clock.sleepCount == 1)
        #expect(vm.state.rest == nil)
        #expect(activity.calls.last == .end)  // the controller lets go of the ended activity
    }

    @Test func skipOnTheLockScreenShowsTheNextSetWithoutRestOver() async {
        let vm = await resting()
        now.advance(seconds: 30)
        activity.lockScreenSkip()
        now.advance(seconds: 4)  // the app opens a few seconds later

        await vm.runRestTimer()
        await vm.timelineSettled()

        // As a Skip in the app: the dock goes to the next set, not "Rest over".
        #expect(vm.state.rest == nil)
        #expect(vm.state.ready == nil)
        #expect(!events.recorded.contains { $0.kind == .restEnded })  // the Lock Screen's button records the skip
    }

    @Test func restExtendTappedAddsToTimeAddedOnTheLockScreen() async {
        let vm = await resting()
        activity.lockScreenExtend(at: now())

        vm.send(.restExtendTapped)

        #expect(vm.state.rest?.total == 150)
        #expect(vm.state.rest?.remaining == 150)
        #expect(activity.calls.last == .update(endsAt: ManualNow.start.addingTimeInterval(150), totalSeconds: 150))
    }

    @Test func restExtendTappedAfterTheRestIsOverOnTheWallClockDoesNothing() async {
        let vm = await resting()
        now.advance(seconds: 95)

        vm.send(.restExtendTapped)

        #expect(vm.state.rest?.total == 90)
        #expect(activity.calls.count == 1)  // only the start
    }

    @Test func doneOnTheLockScreenStartsTheRestInTheApp() async {
        let setID = planned.items[0].sets[0].id
        activity.lockScreenDone(setID, seconds: 90, at: now())
        now.advance(seconds: 20)
        let vm = makeViewModel()

        await vm.run()

        #expect(vm.state.rest?.setID == setID)
        #expect(vm.state.rest?.total == 90)
        #expect(vm.state.rest?.remaining == 70)
        #expect(activity.calls.isEmpty)  // the rest was already on the Lock Screen
    }

    @Test func aRestTheAppStartedIsNotStartedAgain() async {
        let vm = await resting()
        let run = vm.state.rest?.run

        await vm.run()

        #expect(vm.state.rest?.run == run)
    }
}
