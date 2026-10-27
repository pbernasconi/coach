import Foundation
import Testing

@testable import KoboComponents

@Suite struct ChatTimestampLogicTests {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        calendar.locale = Locale(identifier: "en_GB")
        return calendar
    }()

    /// 2026-10-27 15:02 UTC, a Tuesday.
    private let now = Date(timeIntervalSince1970: 1_793_113_320)

    private func ago(_ minutes: Double) -> Date { now.addingTimeInterval(-minutes * 60) }

    @Test func theFirstRowAndLongPausesGetALine() {
        let dates = [ago(300), ago(298), ago(290), ago(200), ago(199)]
        #expect(ChatTimestampLogic.separators(dates, now: now, calendar: calendar) == [0, 3])
    }

    @Test func aNewDayGetsALineEvenAfterAShortPause() {
        // 23:50 and 00:10 the next day: twenty minutes apart, different days.
        let midnight = calendar.startOfDay(for: now)
        let dates = [midnight.addingTimeInterval(-600), midnight.addingTimeInterval(600)]
        #expect(ChatTimestampLogic.separators(dates, now: now, calendar: calendar) == [0, 1])
    }

    @Test func aRowNotYetSavedCountsAsNow() {
        #expect(ChatTimestampLogic.separators([ago(180), nil], now: now, calendar: calendar) == [0, 1])
        #expect(ChatTimestampLogic.separators([ago(5), nil], now: now, calendar: calendar) == [0])
        #expect(ChatTimestampLogic.separators([], now: now, calendar: calendar).isEmpty)
    }

    @Test func todayAndYesterdayAreNamed() {
        let today = ChatTimestampLogic.label(for: ago(61), now: now, calendar: calendar)
        #expect(today.hasPrefix("Today "))
        #expect(today.contains("14:01"))
        let yesterday = ChatTimestampLogic.label(for: ago(24 * 60), now: now, calendar: calendar)
        #expect(yesterday.hasPrefix("Yesterday "))
        #expect(yesterday.contains("15:02"))
    }

    @Test func thisWeekNamesTheWeekday() {
        let label = ChatTimestampLogic.label(for: ago(4 * 24 * 60), now: now, calendar: calendar)
        #expect(label.hasPrefix("Friday "))
    }

    @Test func olderRowsNameTheDateAndOnlyAnotherYearsYear() {
        let thisYear = ChatTimestampLogic.label(for: ago(30 * 24 * 60), now: now, calendar: calendar)
        #expect(thisYear.contains(" at "))
        #expect(thisYear.contains("Sept") || thisYear.contains("Sep"))
        #expect(!thisYear.contains("2026"))
        let lastYear = ChatTimestampLogic.label(for: ago(400 * 24 * 60), now: now, calendar: calendar)
        #expect(lastYear.contains("2025"))
    }

    @Test func dayCountIsCalendarDays() {
        let midnight = calendar.startOfDay(for: now)
        #expect(ChatTimestampLogic.dayCount(from: midnight.addingTimeInterval(-60), to: now, calendar: calendar) == 1)
        #expect(ChatTimestampLogic.dayCount(from: now, to: now, calendar: calendar) == 0)
    }
}
