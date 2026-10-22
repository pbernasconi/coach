import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct HistoryViewModelTests {
    let monday = Fixtures.monday
    let days = DayCalendar(calendar: SessionBuilder.calendar)
    let router = RecordingNavigator()
    let importFlow = RecordingImportFlow()

    func makeViewModel(
        _ repository: FakeSessionRepository,
        library: [Exercise] = ExerciseLibrary.seed,
        segment: HistorySegment = .sessions,
        opensCoachSessions: Bool = false
    ) -> HistoryViewModel {
        HistoryViewModel(
            sessions: repository,
            exercises: FakeExerciseRepository(emissions: [library]),
            router: router,
            importFlow: importFlow,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar,
            segment: segment,
            opensCoachSessions: opensCoachSessions
        )
    }

    @Test func runGroupsPastSessionsByWeekNewestFirst() async {
        let older = SessionBuilder.session(id: 1, on: monday.adding(days: -12), done: 3, planned: 0)
        let tuesday = SessionBuilder.session(id: 2, on: monday.adding(days: -6), done: 2, planned: 1)
        let friday = SessionBuilder.session(id: 3, on: monday.adding(days: -3), done: 3, planned: 0)
        let plannedToday = SessionBuilder.session(id: 4, on: monday, done: 0, planned: 3)
        let startedToday = SessionBuilder.session(id: 5, on: monday, done: 1, planned: 2)
        let repository = FakeSessionRepository(emissions: [[older, tuesday, friday, plannedToday, startedToday]])
        let vm = makeViewModel(repository)

        await vm.run()

        #expect(repository.requestedRanges == [monday.adding(days: -49)...monday])
        guard case .loaded(let weeks) = vm.state.weeks else {
            Issue.record("Expected loaded weeks, got \(vm.state.weeks)")
            return
        }
        let starts = [monday, monday.adding(days: -7), monday.adding(days: -14)]
        #expect(weeks.map(\.id) == starts)
        #expect(weeks.map(\.title) == starts.map { days.weekTitle(start: $0) })
        #expect(weeks.map { $0.sessions.map(\.id) } == [[startedToday.id], [friday.id, tuesday.id], [older.id]])
        #expect(weeks[1].sessions[0].dayTitle == days.shortTitle(of: monday.adding(days: -3)))
        #expect(weeks[1].sessions[1].summary == SessionSummary(detail: tuesday))
    }

    @Test func runShowsEmptyWhenNothingIsPast() async {
        let plannedToday = SessionBuilder.session(id: 1, on: monday, done: 0, planned: 3)
        let vm = makeViewModel(FakeSessionRepository(emissions: [[plannedToday]]))

        await vm.run()

        #expect(vm.state.weeks == .empty)
    }

    @Test func aWorkoutFinishedTodayWithNothingLoggedIsNotHistory() async {
        // Finished with nothing logged is not done (SessionSummary), so it waits on Week like a planned one.
        var finished = SessionBuilder.session(id: 1, on: monday, done: 0, planned: 3)
        finished.session.finishedAt = ManualNow.start
        let vm = makeViewModel(FakeSessionRepository(emissions: [[finished]]))

        await vm.run()

        #expect(vm.state.weeks == .empty)
    }

    @Test func aWorkoutFinishedTodayWithASetLoggedIsHistory() async {
        var finished = SessionBuilder.session(id: 1, on: monday, done: 1, planned: 2)
        finished.session.finishedAt = ManualNow.start
        let vm = makeViewModel(FakeSessionRepository(emissions: [[finished]]))

        await vm.run()

        guard case .loaded(let weeks) = vm.state.weeks else {
            Issue.record("Expected the finished workout, got \(vm.state.weeks)")
            return
        }
        #expect(weeks.flatMap(\.sessions).map(\.id) == [finished.id])
    }

    @Test func sessionTappedOpensTheWorkout() async {
        let friday = SessionBuilder.session(id: 1, on: monday.adding(days: -3), done: 3, planned: 0)
        let vm = makeViewModel(FakeSessionRepository(emissions: [[friday]]))
        await vm.run()
        let before = vm.state

        let task = vm.send(.sessionTapped(friday.id))

        #expect(task == nil)
        #expect(vm.state == before)
        #expect(router.opened == [.workout(friday.id)])
    }

    @Test func sessionTappedOpensTheCoachPageForAFinishedSessionWhenConnected() async {
        var finished = SessionBuilder.session(id: 1, on: monday.adding(days: -3), done: 3, planned: 0)
        finished.session.finishedAt = ManualNow.start
        let open = SessionBuilder.session(id: 2, on: monday.adding(days: -2), done: 1, planned: 2)
        let vm = makeViewModel(FakeSessionRepository(emissions: [[finished, open]]), opensCoachSessions: true)
        await vm.run()

        vm.send(.sessionTapped(finished.id))
        vm.send(.sessionTapped(open.id))

        #expect(router.opened == [.liftSession(finished.id.uuidString.lowercased()), .workout(open.id)])
    }

    @Test func sessionTappedOpensTheWorkoutForAFinishedSessionWhenNotConnected() async {
        var finished = SessionBuilder.session(id: 1, on: monday.adding(days: -3), done: 3, planned: 0)
        finished.session.finishedAt = ManualNow.start
        let vm = makeViewModel(FakeSessionRepository(emissions: [[finished]]), opensCoachSessions: false)
        await vm.run()

        vm.send(.sessionTapped(finished.id))

        #expect(router.opened == [.workout(finished.id)])
    }

    @Test func importTappedOpensTheImportFlow() {
        let vm = makeViewModel(FakeSessionRepository(emissions: []))
        let before = vm.state

        let task = vm.send(.importTapped)

        #expect(task == nil)
        #expect(vm.state == before)
        #expect(importFlow.presented == 1)
        #expect(router.opened.isEmpty)
    }
}
