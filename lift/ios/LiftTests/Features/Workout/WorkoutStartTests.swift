import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// Start workout, the header clock, no Start on an earlier day and no rest after the last set (TEST-2).
/// Writes are awaited through `send(...)?.value`; no sleeps and no real time (TEST-3).
@MainActor
@Suite struct WorkoutStartTests {
    let restActivity = RecordingRestActivityController()

    /// A planned session today that nobody started: one squat with two planned sets.
    let planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 2)
    /// The same, on the day before today (opened from History).
    let yesterday = SessionBuilder.session(id: 2, on: Fixtures.monday.adding(days: -1), done: 0, planned: 2)

    typealias Loaded = (WorkoutViewModel, FakeSessionDetailRepository, RecordingSetRepository)

    func loaded(_ detail: SessionDetail) async -> Loaded {
        let sessions = FakeSessionDetailRepository(emissions: [detail])
        let sets = RecordingSetRepository(result: detail.items[0].sets[0])
        let vm = WorkoutViewModel(
            sessionID: detail.id,
            sessions: sessions,
            sets: sets,
            templates: FakeTemplateRepository(),
            router: RecordingNavigator(),
            clock: ImmediateClock(),
            restActivity: restActivity,
            catalog: FakeExerciseCatalog(),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: RecordingHealthRecorder(),
            gym: InMemoryGymSettings(.standard),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return (vm, sessions, sets)
    }

    // MARK: Start

    @Test func startTappedStartsTheSessionOnceForADoubleTap() async {
        let (vm, sessions, _) = await loaded(planned)

        let first = vm.send(.startTapped)
        let second = vm.send(.startTapped)
        await first?.value

        #expect(second == nil)
        #expect(sessions.calls == [.start(planned.id)])
    }

    @Test func loggingTheFirstSetStartsASessionNobodyStarted() async {
        let (vm, sessions, sets) = await loaded(planned)

        await vm.send(.setLogTapped(planned.items[0].sets[0].id))?.value

        #expect(sets.calls == [.log(planned.items[0].sets[0].id)])
        #expect(sessions.calls == [.start(planned.id)])
    }

    @Test func loggingASetInAStartedSessionLeavesTheStartAlone() async {
        var started = planned
        started.session.startedAt = ManualNow.start
        let (vm, sessions, _) = await loaded(started)

        await vm.send(.setLogTapped(started.items[0].sets[0].id))?.value

        #expect(sessions.calls.isEmpty)
    }

    @Test func finishTappedEndsTheRestHereAndOnTheLockScreen() async {
        let (vm, sessions, _) = await loaded(planned)
        await vm.send(.setLogTapped(planned.items[0].sets[0].id))?.value
        #expect(vm.state.rest != nil)

        await vm.send(.finishTapped)?.value

        #expect(vm.state.rest == nil)
        #expect(restActivity.calls.last == .end)
        #expect(sessions.calls.last == .finish(planned.id))
    }

    // MARK: Clock

    @Test(
        arguments: [
            (0, "00:00"), (5, "00:05"), (65, "01:05"), (599, "09:59"), (3_599, "59:59"), (3_600, "1:00:00"),
            (3_723, "1:02:03"), (-4, "00:00"),
        ] as [(Int, String)]
    )
    func clockText(seconds: Int, text: String) {
        #expect(WorkoutClock.text(seconds: seconds) == text)
    }

    @Test func theClockCountsFromTheStoredStartSoARelaunchShowsTheSameTime() {
        let start = ManualNow.start
        #expect(WorkoutClock.seconds(from: start, to: start.addingTimeInterval(754.9)) == 754)
        #expect(WorkoutClock.seconds(from: start, to: start.addingTimeInterval(-30)) == 0)
    }

    @Test func theHeaderShowsStartThenTheClockThenTheDuration() {
        let days = DayCalendar(calendar: SessionBuilder.calendar)
        var detail = planned
        #expect(WorkoutOverview(detail: detail, days: days, previous: [:], gym: .standard).clockPhase == .notStarted)

        detail.session.startedAt = ManualNow.start
        let running = WorkoutOverview(detail: detail, days: days, previous: [:], gym: .standard)
        #expect(running.clockPhase == .running(since: ManualNow.start))
        #expect(running.dayLine == "Monday, March 2")

        detail.session.finishedAt = ManualNow.start.addingTimeInterval(52 * 60 + 10)
        let finished = WorkoutOverview(detail: detail, days: days, previous: [:], gym: .standard)
        #expect(finished.clockPhase == .finished)
        #expect(finished.durationText == "52:10")
        #expect(finished.dayLine.hasSuffix("Finished · 52:10"))
    }

    @Test func theFirstLoggedSetStartsTheClockBeforeTheStartIsStored() {
        var detail = planned
        detail.items[0].sets[0].status = .done
        detail.items[0].sets[0].completedAt = ManualNow.start
        let overview = WorkoutOverview(
            detail: detail,
            days: DayCalendar(calendar: SessionBuilder.calendar),
            previous: [:],
            gym: .standard
        )
        #expect(overview.clockPhase == .running(since: ManualNow.start))
    }

    // MARK: Earlier days and the last set

    @Test func anEarlierDaysSessionHasNoStartButton() async {
        let (vm, _, _) = await loaded(yesterday)

        guard case .loaded(let workout) = vm.state.workout else {
            Issue.record("not loaded")
            return
        }
        #expect(workout.isPastDay)
        #expect(workout.clockPhase == .pastDay)
    }

    @Test func loggingOnAnEarlierDayDoesNotStampAStart() async {
        let (vm, sessions, sets) = await loaded(yesterday)

        await vm.send(.setLogTapped(yesterday.items[0].sets[0].id))?.value

        #expect(sets.calls == [.log(yesterday.items[0].sets[0].id)])
        #expect(sessions.calls.isEmpty)
    }

    @Test func noRestAfterTheLastPlannedSet() async {
        let last = SessionBuilder.session(id: 3, on: Fixtures.monday, done: 1, planned: 1)
        let (vm, _, _) = await loaded(last)

        await vm.send(.setLogTapped(last.items[0].sets[1].id))?.value

        #expect(vm.state.rest == nil)
        #expect(!restActivity.calls.contains { if case .start = $0 { true } else { false } })
    }
}
