import Foundation
import KoboTokens
import Testing

@testable import KoboComponents

@Suite struct LayoutDayStripSpeechTests {
    private static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        calendar.locale = Locale(identifier: "en_US")
        return calendar
    }

    /// Tuesday 2026-10-20, noon UTC.
    private static let tuesday = Date(timeIntervalSince1970: 1_792_497_600)

    @Test func theDateAndMarkerByDefault() {
        let day = DayItem(date: Self.tuesday, marker: .planned(.accent))
        let text = DayStripSpeech.text(for: day, isToday: false, calendar: Self.calendar)
        #expect(text.hasPrefix("Tuesday, October 20"))
        #expect(text.hasSuffix(", Planned"))
    }

    @Test func todaySitsAfterTheDate() {
        let day = DayItem(date: Self.tuesday, marker: .done(.accent))
        let text = DayStripSpeech.text(for: day, isToday: true, calendar: Self.calendar)
        #expect(text.hasSuffix(", Today, Done"))
    }

    @Test func anItemsOwnLabelReplacesTheDefault() {
        let day = DayItem(date: Self.tuesday, marker: .done(.accent), accessibilityLabel: "Tuesday, done")
        #expect(DayStripSpeech.text(for: day, isToday: false, calendar: Self.calendar) == "Tuesday, done")
        #expect(DayStripSpeech.text(for: day, isToday: true, calendar: Self.calendar) == "Tuesday, done, Today")
    }

    @Test func anEmptyLabelFallsBack() {
        let day = DayItem(date: Self.tuesday, accessibilityLabel: "")
        #expect(DayStripSpeech.text(for: day, isToday: false, calendar: Self.calendar).hasPrefix("Tuesday"))
    }
}
