import Foundation
import Testing

@testable import LiftCore

@Suite struct SessionTitleTests {
    private static let october15 = TestCalendar.date(2026, 10, 15)

    @Test(arguments: [
        ("Workout C- sept 29", "Workout C", LocalDay(year: 2026, month: 9, day: 29)),
        ("Workout lift - July 7", "Workout lift", LocalDay(year: 2026, month: 7, day: 7)),
        ("Workout lift - sept 3", "Workout lift", LocalDay(year: 2026, month: 9, day: 3)),
        ("WORKOUT B — OCT 15", "WORKOUT B", LocalDay(year: 2026, month: 10, day: 15)),
        ("Workout - Oct 16", "Workout", LocalDay(year: 2025, month: 10, day: 16)),
        ("Workout - March 3, 2024", "Workout", LocalDay(year: 2024, month: 3, day: 3)),
        ("Lower A - Nov 2nd", "Lower A", LocalDay(year: 2025, month: 11, day: 2)),
        ("Workout Feb 29", "Workout", LocalDay(year: 2024, month: 2, day: 29)),
        ("Sept 12", "Workout", LocalDay(year: 2026, month: 9, day: 12)),
        ("workout upper: aug. 21", "workout upper", LocalDay(year: 2026, month: 8, day: 21)),
    ])
    func resolvesToTheLatestDateOnOrBeforeReference(line: String, title: String, day: LocalDay) throws {
        let parsed = try #require(SessionTitle.parse(line))
        #expect(parsed.title == title)
        #expect(parsed.resolve(reference: Self.october15, calendar: TestCalendar.gregorian) == day)
    }

    @Test func crossesTheYearBoundary() throws {
        let parsed = try #require(SessionTitle.parse("Workout A - Dec 30"))
        let day = parsed.resolve(reference: TestCalendar.date(2026, 1, 5), calendar: TestCalendar.gregorian)
        #expect(day == LocalDay(year: 2025, month: 12, day: 30))
    }

    @Test func impossibleDatesDoNotResolve() throws {
        let parsed = try #require(SessionTitle.parse("Workout - Feb 30"))
        #expect(parsed.resolve(reference: Self.october15, calendar: TestCalendar.gregorian) == nil)
        let withYear = try #require(SessionTitle.parse("Workout - Feb 29 2025"))
        #expect(withYear.resolve(reference: Self.october15, calendar: TestCalendar.gregorian) == nil)
    }

    @Test(arguments: ["Calf raise may 3", "Workout notes", "Workout - Smarch 3", "Workout - Oct 32", "8 x 255", ""])
    func rejectsLinesThatAreNotTitles(line: String) {
        #expect(SessionTitle.parse(line) == nil)
    }
}
