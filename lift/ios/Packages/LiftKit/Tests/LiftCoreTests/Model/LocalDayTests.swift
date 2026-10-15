import Foundation
import Testing

@testable import LiftCore

@Suite struct LocalDayTests {
    @Test func readsTheDayInTheCalendar() {
        #expect(LocalDay(TestCalendar.date(2026, 9, 29), calendar: TestCalendar.gregorian) == LocalDay(year: 2026, month: 9, day: 29))
    }

    @Test(arguments: [
        (LocalDay(year: 2025, month: 12, day: 31), LocalDay(year: 2026, month: 1, day: 1)),
        (LocalDay(year: 2026, month: 2, day: 28), LocalDay(year: 2026, month: 3, day: 1)),
        (LocalDay(year: 2026, month: 3, day: 1), LocalDay(year: 2026, month: 3, day: 2)),
    ])
    func ordersByDate(earlier: LocalDay, later: LocalDay) {
        #expect(earlier < later)
        #expect(!(later < earlier))
    }

    @Test(arguments: [
        (LocalDay(year: 2026, month: 2, day: 30), false),
        (LocalDay(year: 2024, month: 2, day: 29), true),
        (LocalDay(year: 2025, month: 2, day: 29), false),
        (LocalDay(year: 2026, month: 4, day: 30), true),
    ])
    func knowsWhichDaysExist(day: LocalDay, exists: Bool) {
        #expect((day.startDate(in: TestCalendar.gregorian) != nil) == exists)
    }
}
