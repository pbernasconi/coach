import Foundation
import Testing

@testable import LiftCore

@Suite struct ExerciseHeaderParserTests {
    private struct Case: Sendable, CustomTestStringConvertible {
        let text: String
        let header: ExerciseHeader
        var testDescription: String { text }
    }

    private static let cases: [Case] = [
        Case(text: "Overhead db press", header: ExerciseHeader(name: "Overhead db press")),
        Case(text: "Single arm db row", header: ExerciseHeader(name: "Single arm db row")),
        Case(text: "Kettle bell hip swing", header: ExerciseHeader(name: "Kettle bell hip swing")),
        Case(
            text: "3x225lbx5reps x squat lift",
            header: ExerciseHeader(name: "squat lift", plannedSets: 3, reps: 5, weightValue: 225, unit: .lb)
        ),
        Case(
            text: "3x 135lb x 15reps x calf raises",
            header: ExerciseHeader(name: "calf raises", plannedSets: 3, reps: 15, weightValue: 135, unit: .lb)
        ),
        Case(
            text: "3x … x … single leg Bulgarian squat",
            header: ExerciseHeader(name: "single leg Bulgarian squat", plannedSets: 3)
        ),
        Case(text: "4x ... x ... reverse lunges", header: ExerciseHeader(name: "reverse lunges", plannedSets: 4)),
        Case(
            text: "3x 53*2lbs x 6reps x Bulgarian split squats",
            header: ExerciseHeader(
                name: "Bulgarian split squats",
                plannedSets: 3,
                reps: 6,
                weightValue: 53,
                unit: .lb,
                perHand: true
            )
        ),
        Case(text: "8 pull-ups", header: ExerciseHeader(name: "pull-ups", reps: 8)),
        Case(text: "6-8 chin ups", header: ExerciseHeader(name: "chin ups", repRange: 6...8)),
        Case(text: "3x single dumbbell 💪", header: ExerciseHeader(name: "single dumbbell 💪", plannedSets: 3)),
        Case(
            text: "Romain deadlift - barbell",
            header: ExerciseHeader(name: "Romain deadlift", equipment: .barbell)
        ),
        Case(text: "Lunge – DB", header: ExerciseHeader(name: "Lunge", equipment: .dumbbell)),
        Case(text: "Pull-up", header: ExerciseHeader(name: "Pull-up")),
        Case(
            text: "4x 8-10 reps x leg press",
            header: ExerciseHeader(name: "leg press", plannedSets: 4, repRange: 8...10)
        ),
        Case(text: "3x10 x squats", header: ExerciseHeader(name: "squats", plannedSets: 3, reps: 10)),
        Case(
            text: "3x 60kg x 8reps x front squat",
            header: ExerciseHeader(name: "front squat", plannedSets: 3, reps: 8, weightValue: 60, unit: .kg)
        ),
    ]

    @Test(arguments: cases)
    private func parses(_ testCase: Case) {
        #expect(ExerciseHeaderParser.parse(testCase.text) == testCase.header)
    }

    @Test(arguments: ["123", "…", "8 x 255", "", "💪"])
    func rejectsTextWithoutAName(text: String) {
        #expect(ExerciseHeaderParser.parse(text) == nil)
    }

    @Test func targetCarriesThePrescription() throws {
        let header = try #require(ExerciseHeaderParser.parse("3x 60kg x 8reps x front squat"))
        #expect(header.target == SetTarget(reps: 8, repRange: nil, weight: .kg(60)))
    }
}
