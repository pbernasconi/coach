import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct WeekViewModelTests {
    let monday = Fixtures.monday
    let calendar = SessionBuilder.calendar

    func makeViewModel(_ repository: FakeSessionRepository) -> WeekViewModel {
        WeekViewModel(sessions: repository, now: SessionBuilder.now, calendar: calendar)
    }

    func date(_ day: LocalDay) -> Date {
        day.startDate(in: calendar) ?? .distantPast
    }

    @Test func runObservesTheStripRangeAndShowsToday() async {
        let today = SessionBuilder.session(id: 1, on: monday, done: 0, planned: 3)
        let wednesday = SessionBuilder.session(id: 2, on: monday.adding(days: 2), done: 3, planned: 0)
        let repository = FakeSessionRepository(emissions: [[today, wednesday]])
        let vm = makeViewModel(repository)

        await vm.run()

        #expect(repository.requestedRanges == [monday.adding(days: -28)...monday.adding(days: 34)])
        #expect(vm.state.sessions == .loaded([SessionSummary(detail: today)]))
        let expectedDays = [
            WeekDay(date: date(monday), status: .planned),
            WeekDay(date: date(monday.adding(days: 2)), status: .done),
        ]
        let strip = WeekStrip(today: date(monday), selected: date(monday), title: "Today", days: expectedDays)
        #expect(vm.state.strip == strip)
    }

    @Test func runShowsEmptyWhenTodayHasNoSessions() async {
        let friday = SessionBuilder.session(id: 1, on: monday.adding(days: 4), done: 0, planned: 3)
        let vm = makeViewModel(FakeSessionRepository(emissions: [[], [friday]]))

        await vm.run()

        #expect(vm.state.sessions == .empty)
        #expect(vm.state.strip?.days == [WeekDay(date: date(monday.adding(days: 4)), status: .planned)])
    }

    @Test func daySelectedShowsThatDaysSessions() async {
        let wednesdayDay = monday.adding(days: 2)
        let today = SessionBuilder.session(id: 1, on: monday, done: 0, planned: 3)
        let wednesday = SessionBuilder.session(id: 2, on: wednesdayDay, title: "Upper A", done: 1, planned: 2)
        let vm = makeViewModel(FakeSessionRepository(emissions: [[today, wednesday]]))
        await vm.run()

        let task = vm.send(.daySelected(date(wednesdayDay).addingTimeInterval(3_600)))

        #expect(task == nil)
        #expect(vm.state.sessions == .loaded([SessionSummary(detail: wednesday)]))
        #expect(vm.state.strip?.selected == date(wednesdayDay))
        #expect(vm.state.strip?.title == DayCalendar(calendar: calendar).longTitle(of: wednesdayDay))
    }

    @Test func weekChangedMovesTheVisibleWeek() {
        let vm = makeViewModel(FakeSessionRepository(emissions: []))

        vm.send(.weekChanged(-1))

        #expect(vm.state.weekOffset == -1)
    }

    @Test func sessionTappedLeavesTheStateAlone() async {
        let today = SessionBuilder.session(id: 1, on: monday, done: 0, planned: 3)
        let vm = makeViewModel(FakeSessionRepository(emissions: [[today]]))
        await vm.run()
        let before = vm.state

        let task = vm.send(.sessionTapped(today.id))

        #expect(task == nil)
        #expect(vm.state == before)
    }
}
