import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The bar above the tab bar while a workout is under way: what it says at a given time, when
/// `WorkoutActivityCenter` shows and hides it, and where a tap on it goes (`TabSwitcher.openWorkout`). Made-up sessions
/// only (TEST-8).
@MainActor
@Suite struct ActiveWorkoutBarTests {
    let start = ManualNow.start
    let sessionID = UUID()

    func bar(clock: WorkoutClockPhase, rest: RestSnapshot? = nil, exercise: String? = "Back squat") -> ActiveWorkoutBar
    {
        ActiveWorkoutBar(
            sessionID: sessionID,
            title: "Lower A",
            clock: clock,
            exerciseName: exercise,
            setTitle: exercise == nil ? nil : "Set 2",
            rest: rest,
            progress: 0.25
        )
    }

    // MARK: What it says

    @Test func aRunningWorkoutShowsItsClockAndTheSetToDo() {
        let running = bar(clock: .running(since: start))
        let now = start.addingTimeInterval(1_935)

        #expect(running.clockText(at: now) == "32:15")
        #expect(running.detailText(at: now) == "Back squat · Set 2")
        #expect(running.ringProgress(at: now) == 0.25)
    }

    @Test func aRestCountsUpAgainstItsLengthAndFillsTheRing() {
        let rest = RestSnapshot(endsAt: start.addingTimeInterval(120), totalSeconds: 120)
        let resting = bar(clock: .running(since: start), rest: rest)
        let now = start.addingTimeInterval(36)

        #expect(resting.detailText(at: now) == "Rest 0:36 / 2:00")
        #expect(resting.ringProgress(at: now) == 0.3)
        // Once the rest is over, the bar goes back to the set to do.
        #expect(resting.detailText(at: start.addingTimeInterval(121)) == "Back squat · Set 2")
    }

    @Test func aPausedWorkoutStopsItsClockAndSaysSo() {
        let rest = RestSnapshot(endsAt: start.addingTimeInterval(120), totalSeconds: 120)
        let paused = bar(clock: .paused(elapsed: 600), rest: rest)
        let later = start.addingTimeInterval(3_000)

        #expect(paused.isPaused)
        #expect(paused.clockText(at: later) == "10:00")
        #expect(paused.detailText(at: start) == "Paused")
        #expect(paused.runningRest(at: start) == nil)
    }

    @Test func everySetDoneSaysSo() {
        #expect(bar(clock: .running(since: start), exercise: nil).detailText(at: start) == "All sets done")
    }

    @Test func aSessionLeftOpenForHoursHasNoClock() {
        let open = bar(clock: .running(since: start))
        #expect(open.clockText(at: start.addingTimeInterval(TimeInterval(WorkoutClock.limit + 1))) == nil)
        #expect(open.clockText(at: start.addingTimeInterval(3_725)) == "1:02:05")
    }

    // MARK: When it shows

    @Test func theBarFollowsTheWorkoutUntilItIsFinished() async {
        var started = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 2)
        started.session.startedAt = start
        var finished = started
        finished.session.finishedAt = start.addingTimeInterval(1_800)
        let center = makeCenter(FakeSessionDetailRepository(emissions: [started, finished]))

        center.showWorkout(started.id)
        await center.settle()

        #expect(center.underway.bar == nil)  // finished
    }

    @Test func aStartedWorkoutShowsTheBar() async throws {
        var started = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 2)
        started.session.startedAt = start
        let center = makeCenter(FakeSessionDetailRepository(emissions: [started]))

        center.showWorkout(started.id)
        await center.settle()

        let shown = try #require(center.underway.bar)
        #expect(shown.sessionID == started.id)
        #expect(shown.title == "Lower A")
        #expect(shown.clock == .running(since: start))
        #expect(shown.detailText(at: start) == "Back squat · Set 2")
    }

    @Test func aWorkoutNotStartedShowsNoBar() async {
        let planned = SessionBuilder.session(id: 2, on: Fixtures.monday, done: 0, planned: 3)
        let center = makeCenter(FakeSessionDetailRepository(emissions: [planned]))

        center.showWorkout(planned.id)
        await center.settle()

        #expect(center.underway.bar == nil)
    }

    @Test func theBarShowsWithTheLiveActivityTurnedOff() async {
        var started = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 2)
        started.session.startedAt = start
        var preferences = WorkoutPreferences()
        preferences.showsLiveActivity = false
        let center = makeCenter(FakeSessionDetailRepository(emissions: [started]), preferences: preferences)

        center.showWorkout(started.id)
        await center.settle()

        #expect(center.underway.bar?.sessionID == started.id)
    }

    func makeCenter(
        _ sessions: FakeSessionDetailRepository,
        preferences: WorkoutPreferences = WorkoutPreferences()
    ) -> WorkoutActivityCenter {
        WorkoutActivityCenter(
            sessions: sessions,
            sets: RecordingSetRepository(
                result: SessionBuilder.session(id: 9, on: Fixtures.monday, done: 1, planned: 0)
                    .items[0].sets[0]
            ),
            presenter: RecordingWorkoutActivityPresenter(),
            gym: InMemoryGymSettings(.standard),
            preferences: InMemoryWorkoutSettings(preferences),
            calendar: SessionBuilder.calendar,
            now: { [start] in start }
        )
    }

    // MARK: Where a tap goes

    @Test func aTapGoesBackToTheTabThatHasTheWorkoutOpen() {
        let tabs = TabSwitcher(selected: .week)
        tabs.stackChanged(.week, path: [.workout(sessionID), .exerciseInWorkout(UUID(), note: "")])
        tabs.barPicked(.coach)

        tabs.openWorkout(sessionID)

        #expect(tabs.selected == .week)
        #expect(tabs.routeRequests[.week]?.path == [.workout(sessionID)])  // the page over it closes
        #expect(tabs.routeRequests[.coach] == nil)
    }

    @Test func aTapFindsTheWorkoutOpenFromTheCoachsSessionPage() {
        let tabs = TabSwitcher(selected: .today)
        let page = AppRoute.liftSession(sessionID.uuidString.lowercased())
        tabs.stackChanged(.lift, path: [page])

        tabs.openWorkout(sessionID)

        #expect(tabs.selected == .lift)
        #expect(tabs.routeRequests[.lift]?.path == [page])
    }

    @Test func withTheWorkoutClosedATapOpensItOnTheSelectedTab() {
        let tabs = TabSwitcher(selected: .settings)
        tabs.stackChanged(.week, path: [])
        tabs.stackChanged(.lift, path: [.workout(UUID())])  // another workout

        tabs.openWorkout(sessionID)

        #expect(tabs.selected == .settings)
        #expect(tabs.routeRequests[.settings]?.path == [.workout(sessionID)])
    }
}
