import Foundation
import Testing

@testable import LiftCore

@Suite struct NotesImporterEdgeTests {
    private static func parse(_ text: String, reference: Date = ImportFixtures.reference) -> NotesImport {
        NotesImporter.parse(
            text,
            reference: reference,
            calendar: TestCalendar.gregorian,
            makeID: TestCalendar.sequentialIDs()
        )
    }

    @Test func crlfAndYearBoundary() throws {
        let text = "Workout lift - Dec 30\r\nFront squat\r\n- [x] 5 x 60kg\r\n- [x] 5 x 62.5kg\r\n???\r\n"
        let result = Self.parse(text, reference: TestCalendar.date(2026, 1, 5))
        let session = try #require(result.sessions.first)
        #expect(session.date == LocalDay(year: 2025, month: 12, day: 30))
        #expect(session.unitsAtLog == .kg)
        #expect(session.exercises.first?.sets.map { $0.actual?.weight } == [.kg(60), .kg(62.5)])
        #expect(result.issues == [ImportIssue(line: 5, kind: .unrecognized, text: "???")])
    }

    @Test func linesOutsideSessionsAndStraySetsAreIssues() {
        let text = """
            random preface text
            Workout - Oct 1
            - [x] 8 x 100
            Leg press
            - [x] 12 x 200
            - [x] felt easy
            @@@
            """
        let result = Self.parse(text)
        #expect(result.issues.map(\.kind) == [.outsideSession, .setWithoutExercise, .unrecognized])
        #expect(result.issues.map(\.line) == [1, 3, 7])
        #expect(result.sessions.first?.exercises.first?.note == "felt easy")
        #expect(result.sessions.first?.exercises.first?.exerciseID == ExerciseLibrary.seedID(19))
    }

    @Test func uncheckedSetsTodayArePlannedNotSkipped() throws {
        let result = Self.parse("Workout - Oct 15\nGoblet squat\n- [ ] 10 x 50\n- [ ] 10 x 50")
        let sets = try #require(result.sessions.first?.exercises.first?.sets)
        #expect(sets.allSatisfy { !$0.isSkipped && $0.actual == nil })
        #expect(sets.first?.target == SetTarget(reps: 10, weight: .lb(50)))
        #expect(result.doneSetCount == 0)
    }

    @Test func plainSetLinesWithoutCheckboxesCountAsDone() throws {
        let result = Self.parse("Workout - Oct 3\nGoblet squat\n10 x 50\n10 x 55 heavier\n8")
        let sets = try #require(result.sessions.first?.exercises.first?.sets)
        #expect(sets.map { $0.actual?.reps } == [10, 10, 8])
        #expect(sets[1].note == "heavier")
        #expect(result.issues.isEmpty)
    }

    @Test func inlineSupersetsWithoutAHeadingGetTheirOwnGroups() throws {
        let text = """
            Workout - Oct 3
            - [x] curls 10 @ 25 + lateral raise 12 @ 15
            - [x] curls 10 @ 25 + lateral raise 12 @ 15
            - [x] face pull 15 @ 30 + chin ups 6 @ 0
            Leg press
            - [x] 10 x 300
            """
        let exercises = try #require(Self.parse(text).sessions.first?.exercises)
        #expect(exercises.map(\.displayName) == ["curls", "lateral raise", "face pull", "chin ups", "Leg press"])
        #expect(exercises.map(\.supersetGroup) == [1, 1, 2, 2, nil])
        #expect(exercises.map(\.sets.count) == [2, 2, 1, 1, 1])
    }

    @Test func equipmentLineUnderAHeaderIsAHintNotAnExercise() throws {
        let result = Self.parse("Workout - Oct 3\nRomanian deadlift\nBarbell\n- [x] 8 x 155")
        let exercise = try #require(result.sessions.first?.exercises.first)
        #expect(result.sessions.first?.exercises.count == 1)
        #expect(exercise.equipment == .barbell)
        #expect(result.issues.isEmpty)
    }

    @Test func unitlessSetsInheritTheHeaderUnit() throws {
        let result = Self.parse("Workout - Oct 3\n3x 60kg x 8reps x front squat\n- [x] 8 x 62.5\n- [x] 8")
        let sets = try #require(result.sessions.first?.exercises.first?.sets)
        #expect(sets.map { $0.actual?.weight } == [.kg(62.5), .kg(60)])
        #expect(sets.first?.target.weight == .kg(60))
    }

    @Test func setKindsComeFromNotes() throws {
        let text = "Workout - Oct 3\nBench press\n- [x] 5 x 95 warm up\n- [x] 5 x 185\n- [x] 12 x 135 drop set"
        let sets = try #require(Self.parse(text).sessions.first?.exercises.first?.sets)
        #expect(sets.map(\.kind) == [.warmUp, .working, .drop])
    }

    @Test func impossibleDateFallsBackToTheReferenceDay() {
        let result = Self.parse("Workout - Feb 30\nPlank\n- [x] 1")
        #expect(result.sessions.first?.date == LocalDay(year: 2026, month: 10, day: 15))
        #expect(result.issues == [ImportIssue(line: 1, kind: .invalidDate, text: "Workout - Feb 30")])
    }

    @Test func emojiSmartQuotesAndOddSpacing() throws {
        let text = "Workout 💪 - Oct 3\nGoblet squat 🔥\n\u{00A0}- [x]  10 x 45 didn\u{2019}t do it\n- [X] 10 x 45"
        let result = Self.parse(text)
        let exercise = try #require(result.sessions.first?.exercises.first)
        #expect(result.sessions.first?.title == "Workout 💪")
        #expect(exercise.exerciseID == ExerciseLibrary.seedID(28))
        #expect(exercise.sets.map(\.isSkipped) == [true, false])
        #expect(exercise.sets.first?.note == "didn't do it")
    }

    @Test func kilogramPerSideAndHintUnits() throws {
        let text = "Workout - Oct 3\nHip thrust\n- [x] 10 x 40kg per side next time 45kg"
        let exercise = try #require(Self.parse(text).sessions.first?.exercises.first)
        #expect(exercise.loadMode == .perSide)
        #expect(exercise.nextTimeHint == .kg(45))
    }

    @Test(arguments: ["", "\n\n", "———", "Just some text\nwith no workouts"])
    func emptyOrSessionlessTextYieldsNoSessions(text: String) {
        let result = Self.parse(text)
        #expect(result.sessions.isEmpty)
        #expect(result.issues.count == text.split(whereSeparator: \.isNewline).count)
    }

    @Test func emptySessionTitleStillMakesASession() {
        let result = Self.parse("Workout - Oct 3\n\n")
        #expect(result.sessions.count == 1)
        #expect(result.sessions.first?.exercises.isEmpty == true)
        #expect(result.issues.isEmpty)
    }

    @Test func supersetHeadingGroupsTheHeadersUnderItUntilASeparator() throws {
        let text = """
            Workout - Oct 3
            Superset
            Lateral raise
            - [x] 12 @ 15
            Face pull
            - [x] 15 @ 30
            ——
            Plank
            - [x] 1
            """
        let exercises = try #require(Self.parse(text).sessions.first?.exercises)
        #expect(exercises.map(\.supersetGroup) == [1, 1, nil])
    }

    @Test func placeholderPrescriptionWithNoWeightIsBodyweight() throws {
        let text = "Workout - Oct 3\n3x … x … single leg Bulgarian squat\n- [x] 10\n- [x] 10"
        let exercise = try #require(Self.parse(text).sessions.first?.exercises.first)
        #expect(exercise.exerciseID == ExerciseLibrary.seedID(17))
        #expect(exercise.loadMode == .bodyweight(added: nil))
        #expect(exercise.sets.map(\.actual) == Array(repeating: SetActual(reps: 10), count: 2))
    }
}
