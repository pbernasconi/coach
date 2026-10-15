import Foundation
import Testing

@testable import LiftCore

@Suite struct NotesImporterTests {
    private static let result = NotesImporter.parse(
        ImportFixtures.twoSessions,
        reference: ImportFixtures.reference,
        calendar: TestCalendar.gregorian,
        makeID: TestCalendar.sequentialIDs()
    )

    private static func exercise(_ session: Int, _ index: Int) throws -> SessionExercise {
        let sessions = result.sessions
        try #require(session < sessions.count && index < sessions[session].exercises.count)
        return sessions[session].exercises[index]
    }

    @Test func splitsSessionsOnlyAtTitleLines() {
        #expect(Self.result.sessions.map(\.title) == ["Workout A", "Workout B"])
        #expect(
            Self.result.sessions.map(\.date) == [
                LocalDay(year: 2026, month: 10, day: 6), LocalDay(year: 2026, month: 10, day: 9),
            ]
        )
        #expect(Self.result.sessions.map(\.exercises.count) == [6, 4])
        #expect(Self.result.sessions.allSatisfy { $0.unitsAtLog == .lb && $0.createdAt == ImportFixtures.reference })
    }

    @Test func warmUpBecomesANoteNotSets() {
        #expect(Self.result.sessions.first?.warmUpNote == "6 min rower\n12 mins incline walk += 30 flights")
        #expect(Self.result.sessions.last?.warmUpNote == nil)
    }

    @Test func prescriptionHeaderSetsTargetsAndActuals() throws {
        let squat = try Self.exercise(0, 0)
        #expect(squat.displayName == "squat lift")
        #expect(squat.exerciseID == ExerciseLibrary.seedID(1))
        #expect(squat.loadMode == .total)
        #expect(squat.equipment == .barbell)
        #expect(squat.sets.map(\.isDone) == [true, true, false])
        #expect(squat.sets[0].target == SetTarget(reps: 6, weight: .lb(185)))
        #expect(squat.sets[0].actual == SetActual(reps: 6, weight: .lb(185)))
        #expect(squat.sets[0].note == "DEEP SQUAT")
        #expect(squat.sets[2].isSkipped && squat.sets[2].actual == nil)
        #expect(squat.sets[2].note == "didn't do it")
    }

    @Test func perHandDumbbellsWithAHint() throws {
        let bench = try Self.exercise(0, 1)
        #expect(bench.exerciseID == ExerciseLibrary.seedID(6))
        #expect(bench.loadMode == .perHand)
        #expect(bench.sets.map { $0.actual?.weight } == [.lb(50), .lb(50), nil])
        #expect(bench.sets.map { $0.actual?.reps } == [10, 9, 8])
        #expect(bench.sets[1].note == "slower descent (2 seconds)")
        #expect(bench.nextTimeHint == .lb(55))
        #expect(bench.note == "next time bump to 55lb")
    }

    @Test func repCountHeaderIsBodyweight() throws {
        let pullUps = try Self.exercise(0, 2)
        #expect(pullUps.exerciseID == ExerciseLibrary.seedID(13))
        #expect(pullUps.loadMode == .bodyweight(added: nil))
        #expect(pullUps.sets.map(\.target.reps) == [8, 8, 8])
        #expect(pullUps.sets.map { $0.actual?.reps } == [8, 7, 6])
    }

    @Test func supersetRoundsShareAGroup() throws {
        let members = try (3...5).map { try Self.exercise(0, $0) }
        #expect(members.map(\.displayName) == ["lateral raise", "curls", "OH triceps"])
        #expect(members.map(\.exerciseID) == [23, 24, 25].map(ExerciseLibrary.seedID))
        #expect(members.allSatisfy { $0.supersetGroup == 1 && $0.restSeconds == 90 && $0.sets.count == 3 })
        #expect(members[1].sets.map { $0.actual?.reps } == [12, 11, nil])
        #expect(members.allSatisfy { $0.sets[2].isSkipped })
        #expect(members[2].sets[0].actual?.weight == .lb(35))
    }

    @Test func equipmentSuffixAndPlainHint() throws {
        let rdl = try Self.exercise(1, 0)
        #expect(rdl.displayName == "Romain deadlift")
        #expect(rdl.exerciseID == ExerciseLibrary.seedID(3))
        #expect(rdl.equipment == .barbell)
        #expect(rdl.nextTimeHint == .lb(145))
        #expect(rdl.note == "go 145 next time")
        #expect(rdl.sets[1].note == "the right weight")
    }

    @Test func repsOnlyLinesTakeTheHeaderWeight() throws {
        let split = try Self.exercise(1, 1)
        #expect(split.exerciseID == ExerciseLibrary.seedID(17))
        #expect(split.loadMode == .perHand)
        #expect(split.sets.map { $0.actual?.weight } == Array(repeating: .lb(40), count: 3))
        #expect(split.sets.map(\.target) == Array(repeating: SetTarget(reps: 8, weight: .lb(40)), count: 3))
    }

    @Test func unmatchedNamesKeepTheirDisplayName() throws {
        let swing = try Self.exercise(1, 2)
        #expect(swing.exerciseID == ExerciseLibrary.seedID(21))
        let single = try Self.exercise(1, 3)
        #expect(single.exerciseID == nil)
        #expect(single.displayName == "single dumbbell 💪")
        #expect(single.loadMode == .perHand)
        #expect(single.equipment == .dumbbell)
        #expect(single.sets.map { $0.actual?.weight } == [.lb(30), .lb(25)])
    }

    @Test func danglingHeaderIsAnIssue() {
        #expect(
            Self.result.issues == [
                ImportIssue(line: ImportFixtures.danglingBarbellLine, kind: .headerWithoutSets, text: "Barbell")
            ]
        )
    }

    @Test func roundTripCountsEveryCheckedSet() {
        // 2 squat + 3 bench + 3 pull-ups + 2 rounds × 3 members, then 2 + 3 + 2 + 2.
        #expect(Self.result.doneSetCount == 14 + 9)
        let sets = Self.result.sessions.flatMap(\.allSets)
        #expect(sets.count == 18 + 9)
    }

    @Test func idsComeFromTheInjectedSourceInReadingOrder() throws {
        let first = try #require(Self.result.sessions.first)
        #expect(first.id == TestCalendar.id(1))
        #expect(first.exercises.first?.id == TestCalendar.id(2))
        #expect(first.exercises.first?.sets.map(\.id) == [3, 4, 5].map(TestCalendar.id))
        let again = NotesImporter.parse(
            ImportFixtures.twoSessions,
            reference: ImportFixtures.reference,
            calendar: TestCalendar.gregorian,
            makeID: TestCalendar.sequentialIDs()
        )
        #expect(again == Self.result)
    }
}
