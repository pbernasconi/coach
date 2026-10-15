import Foundation
import Testing

@testable import LiftCore

@Suite struct ExerciseMatcherTests {
    @Test(arguments: [
        ("Overhead db press", 9 as UInt8?),
        ("Single arm db row", 11),
        ("Kettle bell hip swing", 21),
        ("squat lift", 1),
        ("calf raises", 22),
        ("single leg Bulgarian squat", 17),
        ("Bulgarian split squats", 17),
        ("Romain deadlift", 3),
        ("RDL", 3),
        ("pull-ups", 13),
        ("Chin Ups", 14),
        ("OH triceps", 25),
        ("curls", 24),
        ("lateral raise", 23),
        ("DB bench", 6),
        ("Rómanian  Deadlift!!", 3),
        ("Goblet squat 💪", 28),
        ("Back squat (paused)", 1),
        ("row single arm db", 11),
        ("dumbbell bench pull", nil),
        ("single dumbbell 💪", nil),
        ("squat thing", nil),
        ("", nil),
        ("💪", nil),
    ])
    func matchesOnlyExactNormalizedNames(name: String, seed: UInt8?) {
        let match = ExerciseMatcher.match(name: name, in: ExerciseLibrary.seed)
        #expect(match?.exercise.id == seed.map(ExerciseLibrary.seedID))
    }

    @Test(arguments: [
        ("Back squat", ExerciseMatch.Kind.name),
        ("rdl", .alias),
        ("row single arm db", .reorderedTokens),
    ])
    func reportsHowItMatched(name: String, kind: ExerciseMatch.Kind) {
        #expect(ExerciseMatcher.match(name: name, in: ExerciseLibrary.seed)?.kind == kind)
    }

    @Test func skipsArchivedAndDeletedExercises() {
        var library = ExerciseLibrary.seed
        library[0].isArchived = true
        library[2].deletedAt = ExerciseLibrary.seedDate
        #expect(ExerciseMatcher.match(name: "back squat", in: library) == nil)
        #expect(ExerciseMatcher.match(name: "rdl", in: library) == nil)
    }

    @Test func refusesTies() {
        var twin = ExerciseLibrary.seed[4]
        twin.id = TestCalendar.id(77)
        #expect(ExerciseMatcher.match(name: "Bench press", in: ExerciseLibrary.seed + [twin]) == nil)
    }

    @Test(arguments: [
        ("Kettle Bell Swings", "kettlebell swing"),
        ("Pull-Ups", "pull up"),
        ("OH press (light)", "overhead press"),
        ("Café DBs", "cafe dumbbell"),
        ("Farmer's walk", "farmer walk"),
    ])
    func normalizes(name: String, expected: String) {
        #expect(ExerciseMatcher.normalizedName(name) == expected)
    }
}
