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

    @Test(arguments: [
        ([true, true], ", Done"),
        ([true, false], ", Planned"),
        ([false], ", Planned"),
    ])
    func dotsAreDoneOnlyWhenEveryOneIsDone(done: [Bool], suffix: String) {
        let dots = done.map { DayDot(light: 0x2A78D6, dark: 0x3987E5, isDone: $0) }
        let text = DayStripSpeech.text(for: DayItem(date: Self.tuesday, marker: .dots(dots)), isToday: false, calendar: Self.calendar)
        #expect(text.hasSuffix(suffix))
    }

    @Test func noDotsSayNothing() {
        let text = DayStripSpeech.text(for: DayItem(date: Self.tuesday, marker: .dots([])), isToday: false, calendar: Self.calendar)
        #expect(text == "Tuesday, October 20")
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
