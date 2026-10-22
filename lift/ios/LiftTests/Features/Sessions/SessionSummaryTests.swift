import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

@Suite struct SessionSummaryTests {
    @Test(arguments: [
        (0, 3, false),
        (2, 1, false),
        (3, 0, true),
        (0, 0, false),
    ])
    func countsLoggedSets(done: Int, planned: Int, isDone: Bool) {
        let detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: done, planned: planned)

        let summary = SessionSummary(detail: detail)

        #expect(summary.exerciseCount == 1)
        #expect(summary.loggedSets == done)
        #expect(summary.totalSets == done + planned)
        #expect(summary.isDone == isDone)
    }

    @Test func skippedSetsCountAsHandledButNotLogged() {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 1)
        detail.items[0].sets[1].status = .skipped

        let summary = SessionSummary(detail: detail)

        #expect(summary.loggedSets == 1)
        #expect(summary.isDone)
    }

    @Test func aFinishedSessionWithALoggedSetIsDone() {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 2)
        detail.session.finishedAt = ManualNow.start

        #expect(SessionSummary(detail: detail).isDone)
    }

    @Test func aSessionFinishedWithNothingLoggedIsNotDone() {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
        detail.session.finishedAt = ManualNow.start

        #expect(!SessionSummary(detail: detail).isDone)
    }

    @Test func aSessionWithEverySetSkippedIsNotDone() {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 2)
        detail.items[0].sets[0].status = .skipped
        detail.items[0].sets[1].status = .skipped

        #expect(!SessionSummary(detail: detail).isDone)
    }
}

@Suite struct DayCalendarTests {
    let days = DayCalendar(calendar: SessionBuilder.calendar)

    @Test(arguments: [
        (LocalDay(year: 2026, month: 3, day: 2), LocalDay(year: 2026, month: 3, day: 2)),
        (LocalDay(year: 2026, month: 3, day: 8), LocalDay(year: 2026, month: 3, day: 2)),
        (LocalDay(year: 2026, month: 1, day: 1), LocalDay(year: 2025, month: 12, day: 29)),
    ])
    func weekStartsOnTheCalendarsFirstWeekday(day: LocalDay, start: LocalDay) {
        #expect(days.weekStart(of: day) == start)
    }

    @Test func dayRoundTripsThroughItsDate() {
        let day = LocalDay(year: 2026, month: 10, day: 15)

        #expect(days.date(of: day).map { days.day(of: $0) } == day)
    }
}
