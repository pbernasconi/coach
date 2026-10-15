import CraftTokens
import Foundation
import Testing

@testable import CraftComponents

@Suite struct LayoutWeekMathTests {
    private static func calendar(firstWeekday: Int, timeZone: String = "UTC") -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .gmt
        calendar.locale = Locale(identifier: "en_US_POSIX")
        calendar.firstWeekday = firstWeekday
        return calendar
    }

    private static func date(_ year: Int, _ month: Int, _ day: Int, hour: Int = 0, in calendar: Calendar) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: hour)) ?? .distantPast
    }

    private let monday = WeekMath(calendar: Self.calendar(firstWeekday: 2))
    private let sunday = WeekMath(calendar: Self.calendar(firstWeekday: 1))

    private func day(_ year: Int, _ month: Int, _ day: Int, hour: Int = 0, _ math: WeekMath) -> Date {
        Self.date(year, month, day, hour: hour, in: math.calendar)
    }

    @Test func startOfWeekFollowsFirstWeekday() {
        // 2026-10-15 is a Thursday.
        #expect(monday.startOfWeek(containing: day(2026, 10, 15, hour: 9, monday)) == day(2026, 10, 12, monday))
        #expect(sunday.startOfWeek(containing: day(2026, 10, 15, hour: 9, sunday)) == day(2026, 10, 11, sunday))
    }

    @Test func daysOfThisWeekAreSevenMidnights() {
        let days = monday.days(inWeekAt: 0, from: day(2026, 10, 15, hour: 18, monday))
        #expect(days.count == 7)
        #expect(days.first == day(2026, 10, 12, monday))
        #expect(days.last == day(2026, 10, 18, monday))
    }

    @Test func weekSpanningAMonthBoundary() {
        // Wednesday 30 September: the Monday-first week runs 28 Sep – 4 Oct.
        let days = monday.days(inWeekAt: 0, from: day(2026, 9, 30, monday))
        #expect(days.first == day(2026, 9, 28, monday))
        #expect(days.last == day(2026, 10, 4, monday))
    }

    @Test func weekSpanningAYearBoundary() {
        // Thursday 31 December 2026: next week starts Monday 4 January 2027.
        let today = day(2026, 12, 31, monday)
        #expect(monday.days(inWeekAt: 1, from: today).first == day(2027, 1, 4, monday))
        #expect(monday.weekOffset(of: day(2027, 1, 1, monday), from: today) == 0)
        #expect(monday.weekOffset(of: day(2027, 1, 4, monday), from: today) == 1)
    }

    @Test func offsetsMoveWholeWeeks() {
        let today = day(2026, 10, 15, monday)
        #expect(monday.days(inWeekAt: 1, from: today).first == day(2026, 10, 19, monday))
        #expect(monday.days(inWeekAt: -2, from: today).first == day(2026, 9, 28, monday))
    }

    @Test func weekOffsetDependsOnFirstWeekday() {
        // Sunday 4 October belongs to the week of 28 Sep (Monday-first) but starts a week (Sunday-first).
        #expect(monday.weekOffset(of: day(2026, 10, 4, monday), from: day(2026, 10, 15, monday)) == -2)
        #expect(sunday.weekOffset(of: day(2026, 10, 4, sunday), from: day(2026, 10, 15, sunday)) == -1)
        #expect(monday.weekOffset(of: day(2026, 10, 15, hour: 23, monday), from: day(2026, 10, 12, monday)) == 0)
    }

    @Test func daylightSavingWeekStillHasSevenDistinctDays() {
        // Europe/Berlin leaves summer time on Sunday 25 October 2026.
        let berlin = WeekMath(calendar: Self.calendar(firstWeekday: 2, timeZone: "Europe/Berlin"))
        let days = berlin.days(inWeekAt: 0, from: day(2026, 10, 22, berlin))
        #expect(days.count == 7)
        #expect(Set(days.map { berlin.calendar.component(.day, from: $0) }) == Set(19...25))
        #expect(days.allSatisfy { berlin.calendar.startOfDay(for: $0) == $0 })
    }

    @Test func weekdaySymbolsStartAtFirstWeekday() {
        #expect(monday.weekdaySymbols() == ["M", "T", "W", "T", "F", "S", "S"])
        #expect(sunday.weekdaySymbols() == ["S", "M", "T", "W", "T", "F", "S"])
    }

    @Test func pagesCarryMarkersBySameDay() {
        let today = day(2026, 10, 15, monday)
        let items = [
            DayItem(date: day(2026, 10, 13, hour: 15, monday), marker: .done(.accent)),
            DayItem(date: day(2026, 10, 20, hour: 7, monday), marker: .planned(.info)),
        ]
        let pages = monday.pages(weeks: -1...1, today: today, items: items)
        #expect(pages.map(\.id) == [-1, 0, 1])
        #expect(pages[1].days[1].marker == .done(.accent))
        #expect(pages[2].days[1].marker == .planned(.info))
        #expect(pages[1].days[0].marker == DayMarker.none)
    }

    @Test func pastAndToday() {
        let today = day(2026, 10, 15, hour: 12, monday)
        #expect(monday.isPast(day(2026, 10, 14, hour: 23, monday), today: today))
        #expect(!monday.isPast(day(2026, 10, 15, monday), today: today))
        #expect(DayItem(date: day(2026, 10, 15, hour: 1, monday)).isToday(today, calendar: monday.calendar))
    }
}
