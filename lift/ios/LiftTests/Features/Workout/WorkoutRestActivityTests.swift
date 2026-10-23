import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The rest as a Live Activity: what the Workout ViewModel starts, moves and ends. One test per behaviour, with a
/// recording fake, a manual wall clock and a clock that never really sleeps (TEST-3).
@MainActor
@Suite struct WorkoutRestActivityTests {
    let planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
    let started = SessionBuilder.session(id: 2, on: Fixtures.monday, done: 1, planned: 2)
    let activity = RecordingRestActivityController()
    let now = ManualNow()
    let clock = ImmediateClock()

    func makeViewModel(_ detail: SessionDetail) -> WorkoutViewModel {
        WorkoutViewModel(
            sessionID: detail.id,
            sessions: FakeSessionDetailRepository(emissions: [detail]),
            sets: RecordingSetRepository(result: detail.items[0].sets[0]),
            templates: FakeTemplateRepository(),
            router: RecordingNavigator(),
            clock: clock,
            restActivity: activity,
            catalog: FakeExerciseCatalog(),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: RecordingHealthRecorder(),
            gym: InMemoryGymSettings(.standard),
            preferences: InMemoryWorkoutSettings(),
            now: { [now] in now() },
            calendar: SessionBuilder.calendar
        )
    }

    /// A view model that has logged the first set of `planned`, so a rest is running.
    func resting() async -> WorkoutViewModel {
        let vm = makeViewModel(planned)
        await vm.run()
        await vm.send(.setLogTapped(planned.items[0].sets[0].id))?.value
        return vm
    }

    /// The "rest over" bar after the first set's rest: the second set, counting up from when the rest ran out.
    var nextSetReady: RestReady {
        RestReady(
            setID: planned.items[0].sets[1].id,
            title: "Back squat · Set 2",
            target: "5 @ 100 kg",
            since: ManualNow.start
        )
    }

    var restStart: RecordingRestActivityController.Call {
        .start(
            RestActivityAttributes(exerciseName: "Back squat", setLabel: "Set 1"),
            RestActivityAttributes.ContentState(
                endsAt: ManualNow.start.addingTimeInterval(90),
                totalSeconds: 90,
                nextSetLabel: "Set 2 · 5 @ 100 kg"
            )
        )
    }

    @Test func setLogTappedStartsTheActivityWithTheNextSet() async {
        let vm = await resting()

        #expect(vm.state.rest != nil)
        #expect(activity.calls == [restStart])
    }

    @Test func setLogTappedOnALoggedSetLeavesTheActivityAlone() async {
        let vm = makeViewModel(started)
        await vm.run()

        await vm.send(.setLogTapped(started.items[0].sets[0].id))?.value

        #expect(activity.calls.isEmpty)
    }

    @Test func restExtendTappedMovesTheActivityEnd() async {
        let vm = await resting()

        vm.send(.restExtendTapped)

        #expect(
            activity.calls == [restStart, .update(endsAt: ManualNow.start.addingTimeInterval(120), totalSeconds: 120)]
        )
    }

    @Test func restSkipTappedEndsTheActivity() async {
        let vm = await resting()

        vm.send(.restSkipTapped)

        #expect(activity.calls == [restStart, .end])
    }

    @Test func runRestTimerEndsTheActivityAtZero() async {
        let vm = await resting()

        await vm.runRestTimer()

        #expect(vm.state.rest == nil)
        #expect(activity.calls == [restStart, .end])
    }

    @Test func runRestTimerTurnsTheBarToTheNextSetAtZero() async {
        let vm = await resting()

        await vm.runRestTimer()

        #expect(vm.state.ready == nextSetReady)
    }

    @Test func restSkipTappedTurnsTheDockToTheNextSetWithoutRestOver() async {
        let vm = await resting()

        vm.send(.restSkipTapped)

        #expect(vm.state.rest == nil)
        #expect(vm.state.ready == nil)
        #expect(activity.calls == [restStart, .end])
    }

    @Test func restReadyDismissedClosesTheBar() async {
        let vm = await resting()
        await vm.runRestTimer()

        vm.send(.restReadyDismissed)

        #expect(vm.state.ready == nil)
    }

    @Test func setLogTappedFromTheReadyBarStartsTheNextRest() async {
        let vm = await resting()
        await vm.runRestTimer()

        await vm.send(.setLogTapped(nextSetReady.setID))?.value

        #expect(vm.state.ready == nil)
        #expect(vm.state.rest?.setID == nextSetReady.setID)
    }

    @Test func runRestTimerCatchesUpWithTheWallClockAfterTheBackground() async {
        let vm = await resting()
        now.advance(seconds: 60)

        await vm.runRestTimer()

        #expect(clock.sleepCount == 1 + 30)  // the first tick finds 30 s left on the wall clock
        #expect(activity.calls == [restStart, .end])
    }

    @Test func runShowsTheWorkoutOnTheLockScreen() async {
        let vm = makeViewModel(planned)

        await vm.run()

        #expect(!activity.shownWorkouts.isEmpty)
        #expect(Set(activity.shownWorkouts) == [planned.id])
    }

    @Test func leavingTheWorkoutKeepsTheRestOnTheLockScreen() async {
        var vm: WorkoutViewModel? = await resting()
        #expect(vm?.state.rest != nil)

        vm = nil

        #expect(activity.calls == [restStart])
    }

    @Test func leavingWithoutARestLeavesTheActivityAlone() async {
        var vm: WorkoutViewModel? = makeViewModel(planned)
        await vm?.run()

        vm = nil

        #expect(activity.calls.isEmpty)
    }
}

/// `WorkoutOverview.restActivity(afterLogging:)`: the labels on the Live Activity. Made-up sessions only (TEST-8).
@Suite struct RestActivityStartTests {
    static func set(_ number: UInt8, _ title: String, _ status: SetStatus) -> WorkoutSetItem {
        WorkoutSetItem(id: .fixture(number), title: title, target: "5 @ 100 kg", actual: nil, status: status)
    }

    static func exercise(_ number: UInt8, _ name: String, sets: [WorkoutSetItem]) -> WorkoutExercise {
        WorkoutExercise(
            id: .fixture(number),
            name: name,
            target: nil,
            warmUp: nil,
            plates: nil,
            progression: nil,
            sets: sets
        )
    }

    let overview = WorkoutOverview(
        title: "Lower A",
        dayTitle: "Monday, 2 March",
        loggedSets: 1,
        totalSets: 4,
        exercises: [
            exercise(10, "Back squat", sets: [set(11, "Set 1", .skipped), set(12, "Set 2", .planned)]),
            exercise(20, "Romanian deadlift", sets: [set(21, "Set 1", .done), set(22, "Set 2", .planned)]),
        ]
    )

    @Test func nextSetInAnotherExerciseIsNamedWithIt() {
        let start = overview.restActivity(afterLogging: .fixture(12))

        #expect(start?.attributes == RestActivityAttributes(exerciseName: "Back squat", setLabel: "Set 2"))
        #expect(start?.nextSetLabel == "Romanian deadlift · Set 2 · 5 @ 100 kg")
    }

    @Test func afterTheLastSetItLooksBackForAPlannedOne() {
        let start = overview.restActivity(afterLogging: .fixture(22))

        #expect(start?.nextSetLabel == "Back squat · Set 2 · 5 @ 100 kg")
    }

    @Test func withNothingPlannedThereIsNoNextSet() {
        var done = overview
        done.exercises[0].sets[1].status = .done

        #expect(done.restActivity(afterLogging: .fixture(22))?.nextSetLabel == nil)
        #expect(done.restActivity(afterLogging: .fixture(99)) == nil)
    }

    @Test func restLabelNamesTheExerciseAndSet() {
        #expect(overview.restLabel(for: .fixture(21)) == "Romanian deadlift · Set 1")
        #expect(overview.restLabel(for: .fixture(99)) == nil)
    }

    @Test func restReadyPointsAtTheNextPlannedSet() {
        let ready = overview.restReady(after: .fixture(12), since: ManualNow.start)

        #expect(ready?.setID == .fixture(22))
        #expect(ready?.title == "Romanian deadlift · Set 2")
        #expect(overview.isPlanned(.fixture(22)))
        #expect(!overview.isPlanned(.fixture(21)))
    }
}
