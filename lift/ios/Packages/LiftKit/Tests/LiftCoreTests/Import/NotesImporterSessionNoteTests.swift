import Foundation
import Testing

@testable import LiftCore

/// A free-text line in a workout that no sets follow ("Felt strong") is the session's note, not an exercise header
/// without sets. Every note here is made up (TEST-8).
@Suite struct NotesImporterSessionNoteTests {
    private static func parse(_ text: String) -> NotesImport {
        NotesImporter.parse(
            text,
            reference: ImportFixtures.reference,
            calendar: TestCalendar.gregorian,
            makeID: TestCalendar.sequentialIDs()
        )
    }

    @Test func aLineUnderTheTitleIsTheSessionNote() throws {
        let result = Self.parse(
            """
            Legs - Oct 6
            Felt strong
            Goblet squat
            - [x] 10 x 50
            - [x] 10 x 50
            """
        )
        let session = try #require(result.sessions.first)
        #expect(session.note == "Felt strong")
        #expect(session.exercises.map(\.displayName) == ["Goblet squat"])
        #expect(result.issues.isEmpty)
    }

    @Test(arguments: [
        "Felt strong",
        "Short on time today",
        "Slept 6 hours, knees ok",
        "gym was packed!",
        "Tired 😴",
    ])
    func freeTextAtTheEndOfASessionIsItsNote(line: String) throws {
        let result = Self.parse(
            "Push - Oct 6\nOverhead press\n- [x] 5 x 40kg\n\(line)\nPull - Oct 8\nDeadlift\n- [x] 5"
        )
        #expect(result.sessions.map(\.note) == [line, nil])
        #expect(result.sessions.map(\.exercises.count) == [1, 1])
        #expect(result.issues.isEmpty)
    }

    @Test func linesBetweenExercisesJoinInReadingOrderWithTheOtherSessionNotes() throws {
        let result = Self.parse(
            """
            Upper - Oct 7
            Felt strong
            Dumbbell bench press
            - [x] 10 x 2x 50lb
            —
            Elbow a bit sore
            Cable row
            12 x 90
            ——
            Next time: start earlier
            Good session overall
            """
        )
        let session = try #require(result.sessions.first)
        #expect(
            session.note
                == "Felt strong\nElbow a bit sore\nNext time: start earlier\nGood session overall"
        )
        #expect(session.exercises.map(\.displayName) == ["Dumbbell bench press", "Cable row"])
        #expect(result.issues.isEmpty)
    }

    @Test func aNextTimeLineUnderTheNoteStaysWithIt() throws {
        let result = Self.parse("Legs - Oct 9\nFelt slow\ngo heavier next time\nLeg press\n- [x] 12 x 200")
        let session = try #require(result.sessions.first)
        #expect(session.note == "Felt slow\ngo heavier next time")
        #expect(session.exercises.first?.nextTimeHint == nil)
        #expect(result.issues.isEmpty)
    }

    @Test func aLineThatSetsFollowIsStillAnExercise() throws {
        let result = Self.parse("Legs - Oct 9\nFelt strong\n- [x] 5 x 100\n- [x] 5 x 100")
        let session = try #require(result.sessions.first)
        #expect(session.exercises.map(\.displayName) == ["Felt strong"])
        #expect(session.note == nil)
    }

    @Test(arguments: [
        "Barbell",  // an equipment word on its own line
        "Bench press",  // a library exercise
        "Single arm db row",  // equipment inside the name
        "Hack squat",  // a movement word
        "Seated calf raises",
        "3x 185lb x 6reps x squat lift",  // a prescription
        "8 pull-ups",  // a rep count
        "Romain deadlift - barbell",  // an equipment suffix
    ])
    func anExerciseHeaderWithoutSetsStaysAnIssue(header: String) throws {
        let result = Self.parse("Workout - Oct 6\n\(header)\nGoblet squat\n- [x] 10 x 50")
        #expect(result.issues == [ImportIssue(line: 2, kind: .headerWithoutSets, text: header)])
        #expect(result.sessions.first?.note == nil)
    }

    @Test func aNoteInsideASupersetBlockIsTheSessionNote() throws {
        let result = Self.parse(
            """
            Arms workout - Oct 10
            Superset
            Pump was great
            - [x] curls 12 @ 20 + OH triceps 12 @ 35
            - [x] curls 10 @ 20 + OH triceps 10 @ 35
            """
        )
        let session = try #require(result.sessions.first)
        #expect(session.note == "Pump was great")
        #expect(session.exercises.count == 2)
        #expect(result.issues.isEmpty)
    }

    @Test func aWorkoutWithOnlyANoteHasNoExercisesAndNoIssues() throws {
        let result = Self.parse("Workout - Oct 11\nWalked 5k instead\r\n")
        let session = try #require(result.sessions.first)
        #expect(session.note == "Walked 5k instead")
        #expect(session.exercises.isEmpty)
        #expect(result.issues.isEmpty)
    }

    @Test func idsStayInReadingOrderAroundANote() throws {
        let result = Self.parse("Legs - Oct 9\nFelt strong\nGoblet squat\n10 x 50")
        let session = try #require(result.sessions.first)
        #expect(session.id == TestCalendar.id(1))
        #expect(session.exercises.first?.id == TestCalendar.id(2))
        #expect(session.exercises.first?.sets.first?.id == TestCalendar.id(3))
    }

    @Test func theTwoSessionFixtureReadsAsBefore() {
        let result = Self.parse(ImportFixtures.twoSessions)
        #expect(result.sessions.map(\.note) == [nil, nil])
        #expect(result.sessions.map(\.exercises.count) == [6, 4])
        #expect(result.issues.map(\.kind) == [.headerWithoutSets])
    }
}
