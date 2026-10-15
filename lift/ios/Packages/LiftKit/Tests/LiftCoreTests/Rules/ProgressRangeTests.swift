import Foundation
import Testing

@testable import LiftCore

@Suite struct ProgressRangeTests {
    private static func day(_ year: Int, _ month: Int, _ day: Int) -> LocalDay {
        LocalDay(year: year, month: month, day: day)
    }

    @Test(arguments: [
        (ProgressRange.threeMonths, Self.day(2026, 7, 15)),
        (.sixMonths, Self.day(2026, 4, 15)),
        (.year, Self.day(2025, 10, 15)),
    ])
    func firstDayIsMonthsBack(range: ProgressRange, expected: LocalDay) {
        #expect(range.firstDay(today: Self.day(2026, 10, 15)) == expected)
    }

    @Test func allHasNoFirstDay() {
        #expect(ProgressRange.all.firstDay(today: Self.day(2026, 10, 15)) == nil)
    }

    @Test(arguments: [
        (Self.day(2026, 5, 31), -3, Self.day(2026, 2, 28)),
        (Self.day(2024, 5, 31), -3, Self.day(2024, 2, 29)),
        (Self.day(2026, 1, 15), -1, Self.day(2025, 12, 15)),
        (Self.day(2026, 2, 10), -14, Self.day(2024, 12, 10)),
        (Self.day(2026, 11, 30), 3, Self.day(2027, 2, 28)),
        (Self.day(2026, 3, 1), 0, Self.day(2026, 3, 1)),
    ])
    func addingMonthsClampsToTheMonthEnd(start: LocalDay, months: Int, expected: LocalDay) {
        #expect(start.adding(months: months) == expected)
    }
}
