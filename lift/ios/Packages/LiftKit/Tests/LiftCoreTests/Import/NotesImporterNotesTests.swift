import Foundation
import Testing

@testable import LiftCore

/// The importer keeps every note in a made-up log (TEST-8): the session's, the warm-up's, the exercise's with its
/// next-time weight, and each set's. Noon on the workout's day is the time imported sets are stamped with.
@Suite struct NotesImporterNotesTests {
    private static let note = """
        Push day - Mar 3
        Warmup: 5 min rower
        Overhead press
        - [x] 5 x 40kg paused
        - [x] 5 x 40kg
        next time 42.5kg
        —
        Next time: start earlier
        """

    private func parse() throws -> Session {
        let result = NotesImporter.parse(
            Self.note,
            reference: TestCalendar.date(2026, 3, 10),
            calendar: TestCalendar.gregorian,
            makeID: TestCalendar.sequentialIDs()
        )
        return try #require(result.sessions.first)
    }

    @Test func keepsTheSessionAndWarmUpNotes() throws {
        let session = try parse()
        #expect(session.note == "Next time: start earlier")
        #expect(session.warmUpNote == "5 min rower")
    }

    @Test func keepsSetNotesAndTheNextTimeWeight() throws {
        let press = try #require(try parse().exercises.first)
        #expect(press.sets.map(\.note) == ["paused", nil])
        #expect(press.nextTimeHint == .kg(42.5))
        #expect(press.note == "next time 42.5kg")
    }

    @Test func noonIsMiddayOnTheDayInTheCalendar() throws {
        let day = LocalDay(year: 2026, month: 3, day: 3)
        let noon = try #require(day.noon(in: TestCalendar.gregorian))
        #expect(noon == TestCalendar.date(2026, 3, 3))
        #expect(LocalDay(noon, calendar: TestCalendar.gregorian) == day)
    }

    @Test func noonStaysOnTheDayInAnyTimeZone() throws {
        for zone in ["Pacific/Kiritimati", "America/Los_Angeles", "Pacific/Pago_Pago", "Europe/Rome"] {
            var calendar = TestCalendar.gregorian
            calendar.timeZone = try #require(TimeZone(identifier: zone))
            let day = LocalDay(year: 2026, month: 3, day: 29)  // the EU daylight-saving switch
            let noon = try #require(day.noon(in: calendar))
            #expect(LocalDay(noon, calendar: calendar) == day)
            #expect(calendar.component(.hour, from: noon) == 12)
        }
    }

    @Test func noonOfADayThatDoesNotExistIsNil() {
        #expect(LocalDay(year: 2026, month: 2, day: 30).noon(in: TestCalendar.gregorian) == nil)
    }
}
