import Foundation
import Testing

@testable import LiftCore

@Suite struct LiftWeekTests {
    /// A US calendar, whose own weeks start on Sunday.
    private static func us(timeZone: String = "UTC") -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_US")
        calendar.timeZone = TimeZone(identifier: timeZone) ?? TimeZone(secondsFromGMT: 0) ?? calendar.timeZone
        calendar.firstWeekday = 1
        return calendar
    }

    @Test func startsWeeksOnMondayWhateverTheLocale() {
        let us = Self.us(timeZone: "America/Chicago")
        let calendar = us.startingWeeksOnMonday()
        #expect(calendar.firstWeekday == 2)
        #expect(calendar.locale == us.locale)
        #expect(calendar.timeZone == us.timeZone)
        #expect(calendar.identifier == .gregorian)
    }

    @Test(arguments: [
        // Monday 2026-10-12 through Sunday 2026-10-18 are one week.
        (LocalDay(year: 2026, month: 10, day: 12), LocalDay(year: 2026, month: 10, day: 12)),
        (LocalDay(year: 2026, month: 10, day: 15), LocalDay(year: 2026, month: 10, day: 12)),
        (LocalDay(year: 2026, month: 10, day: 18), LocalDay(year: 2026, month: 10, day: 12)),
        (LocalDay(year: 2026, month: 10, day: 19), LocalDay(year: 2026, month: 10, day: 19)),
        // Across a year and a month boundary.
        (LocalDay(year: 2027, month: 1, day: 1), LocalDay(year: 2026, month: 12, day: 28)),
        (LocalDay(year: 2026, month: 3, day: 1), LocalDay(year: 2026, month: 2, day: 23)),
    ])
    func weekStartIsTheMondayBefore(day: LocalDay, start: LocalDay) {
        #expect(Self.us().startingWeeksOnMonday().weekStart(of: day) == start)
    }

    @Test func sundayStillEndsTheWeekAcrossADaylightSavingChange() {
        // 2026-11-01 is the Sunday the US leaves daylight saving time.
        let calendar = Self.us(timeZone: "America/New_York").startingWeeksOnMonday()
        #expect(
            calendar.weekStart(of: LocalDay(year: 2026, month: 11, day: 1)) == LocalDay(year: 2026, month: 10, day: 26)
        )
        #expect(
            calendar.weekStart(of: LocalDay(year: 2026, month: 11, day: 2)) == LocalDay(year: 2026, month: 11, day: 2)
        )
    }

    @Test func aUSCalendarAloneWouldStartOnSunday() {
        #expect(
            Self.us().weekStart(of: LocalDay(year: 2026, month: 10, day: 15))
                == LocalDay(year: 2026, month: 10, day: 11)
        )
    }

    @Test func aDayTheCalendarCannotBuildIsItsOwnStart() {
        let impossible = LocalDay(year: 2026, month: 2, day: 30)
        #expect(Self.us().startingWeeksOnMonday().weekStart(of: impossible) == impossible)
    }

    @Test func weekStartsAreSevenDaysApart() {
        let calendar = Self.us().startingWeeksOnMonday()
        let start = calendar.weekStart(of: LocalDay(year: 2026, month: 10, day: 14))
        #expect(calendar.weekStart(of: start.adding(days: 7)) == start.adding(days: 7))
        #expect(calendar.weekStart(of: start.adding(days: -1)) == start.adding(days: -7))
    }
}
