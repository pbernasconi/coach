import Testing

@testable import LiftCore

@Suite struct LocalDayArithmeticTests {
    @Test(arguments: [
        (LocalDay(year: 1970, month: 1, day: 1), 0),
        (LocalDay(year: 1969, month: 12, day: 31), -1),
        (LocalDay(year: 2000, month: 3, day: 1), 11_017),
        (LocalDay(year: 2026, month: 1, day: 1), 20_454),
    ])
    func daysSinceEpoch(day: LocalDay, expected: Int) {
        #expect(day.daysSinceEpoch == expected)
        #expect(LocalDay(daysSinceEpoch: expected) == day)
    }

    @Test(arguments: [
        (LocalDay(year: 2026, month: 3, day: 2), 7, LocalDay(year: 2026, month: 3, day: 9)),
        (LocalDay(year: 2026, month: 12, day: 28), 7, LocalDay(year: 2027, month: 1, day: 4)),
        (LocalDay(year: 2028, month: 2, day: 26), 7, LocalDay(year: 2028, month: 3, day: 4)),
        (LocalDay(year: 2027, month: 2, day: 26), 3, LocalDay(year: 2027, month: 3, day: 1)),
        (LocalDay(year: 2026, month: 3, day: 1), -1, LocalDay(year: 2026, month: 2, day: 28)),
    ])
    func adding(start: LocalDay, days: Int, expected: LocalDay) {
        #expect(start.adding(days: days) == expected)
    }

    @Test func roundTripsEveryDayForFiveYears() {
        let start = LocalDay(year: 2024, month: 1, day: 1).daysSinceEpoch
        for serial in start..<(start + 5 * 366) {
            #expect(LocalDay(daysSinceEpoch: serial).daysSinceEpoch == serial)
        }
    }
}
