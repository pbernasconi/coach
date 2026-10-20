import Foundation
import Testing

@testable import KoboComponents

/// The month grid and quick picks, with the first
/// weekday taken from the calendar.
@Suite struct FieldsMonthGridTests {
    private static func calendar(firstWeekday: Int) -> Calendar {
        var calendar = FieldsDateFieldLogicTests.calendar
        calendar.firstWeekday = firstWeekday
        return calendar
    }

    private let sunday = MonthGrid(calendar: Self.calendar(firstWeekday: 1))
    private let monday = MonthGrid(calendar: Self.calendar(firstWeekday: 2))
    private func day(_ iso: String) -> Date { FieldsDateFieldLogicTests.day(iso) ?? .distantPast }

    @Test func theGridIsSixWeeksStartingOnTheFirstWeekday() {
        let weeks = sunday.weeks(of: day("2026-09-15"))
        #expect(weeks.count == 6)
        #expect(weeks.allSatisfy { $0.count == 7 })
        #expect(weeks.allSatisfy { week in week.first.map { sunday.calendar.component(.weekday, from: $0) } == 1 })
        #expect(weeks.first?.first == day("2026-08-30"))
        #expect(weeks.last?.last == day("2026-10-10"))
        #expect(monday.weeks(of: day("2026-09-15")).first?.first == day("2026-08-31"))
    }

    @Test func aMonthThatStartsOnTheFirstWeekdayHasNoLeadingDays() {
        #expect(sunday.weeks(of: day("2026-11-01")).first?.first == day("2026-11-01"))
        #expect(monday.weeks(of: day("2026-06-10")).first?.first == day("2026-06-01"))
    }

    @Test func pagingStopsAtTheBoundMonthsAndTheStartMonthIsClamped() {
        let min = day("2026-09-14"), max = day("2026-11-02"), september = day("2026-09-01")
        #expect(!sunday.canGoToPreviousMonth(september, minDate: min))
        #expect(sunday.canGoToNextMonth(september, maxDate: max))
        #expect(!sunday.canGoToNextMonth(max, maxDate: max))
        #expect(sunday.canGoToPreviousMonth(september, minDate: nil))
        #expect(sunday.clampMonth(day("2026-01-20"), minDate: min, maxDate: max) == september)
        #expect(sunday.clampMonth(day("2027-01-20"), minDate: min, maxDate: max) == day("2026-11-01"))
        #expect(sunday.month(day("2026-12-15"), adding: 1) == day("2027-01-01"))
        #expect(sunday.month(day("2026-03-31"), adding: -1) == day("2026-02-01"))
    }

    @Test func withNoMaxDateTheLastDayIsTwelveMonthsAhead() {
        let today = day("2026-09-12")
        let upper = sunday.upperBound(maxDate: nil, today: today)
        #expect(upper == day("2027-09-12"))
        let bounds = DateBounds(maxDate: upper)
        #expect(bounds.isSelectable(day("2027-09-12"), calendar: sunday.calendar))
        #expect(!bounds.isSelectable(day("2027-09-13"), calendar: sunday.calendar))
        #expect(sunday.upperBound(maxDate: day("2026-10-01"), today: today) == day("2026-10-01"))
    }

    @Test func boundsCompareByDayNotTime() {
        let bounds = DateBounds(minDate: day("2026-07-24").addingTimeInterval(20 * 3600))
        #expect(bounds.isSelectable(day("2026-07-24").addingTimeInterval(3600), calendar: sunday.calendar))
        #expect(!bounds.isSelectable(day("2026-07-23"), calendar: sunday.calendar))
    }

    @Test func weekdaySymbolsStartOnTheFirstWeekday() {
        #expect(sunday.weekdaySymbols().first == "S")
        #expect(monday.weekdaySymbols().first == "M")
        #expect(monday.weekdaySymbols().count == 7)
    }

    @Test func inMonthIsByCalendarMonth() {
        #expect(sunday.isInMonth(day("2026-09-30"), month: day("2026-09-01")))
        #expect(!sunday.isInMonth(day("2026-10-01"), month: day("2026-09-01")))
    }

    private func picks(today: String, min: String? = nil, max: String? = nil, weekdays: Bool = false)
        -> [DateQuickPick]
    {
        let calendar = sunday.calendar
        var rule: (@Sendable (Date) -> Bool)?
        if weekdays { rule = { @Sendable day in calendar.isDateInWeekend(day) } }
        let bounds = DateBounds(minDate: min.map(day), maxDate: max.map(day), isDateDisabled: rule)
        return DateQuickPick.picks(today: day(today), bounds: bounds, calendar: calendar)
    }

    @Test func quickPicksOfferOnlySelectableDays() {
        #expect(picks(today: "2026-08-31") == [.today(day("2026-08-31")), .tomorrow(day("2026-09-01"))])
        #expect(picks(today: "2026-08-31", min: "2026-09-01") == [.tomorrow(day("2026-09-01"))])
        #expect(picks(today: "2026-08-31", min: "2026-09-03") == [.earliest(day("2026-09-03"))])
        #expect(picks(today: "2026-09-04", weekdays: true) == [.today(day("2026-09-04"))])
        #expect(picks(today: "2026-08-31", min: "2026-09-05", weekdays: true).isEmpty)
        #expect(picks(today: "2026-08-31", min: "2026-09-03", max: "2026-09-02").isEmpty)
    }
}
