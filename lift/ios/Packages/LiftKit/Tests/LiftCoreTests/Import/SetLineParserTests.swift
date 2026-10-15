import Foundation
import Testing

@testable import LiftCore

@Suite struct SetLineParserTests {
    private struct Case: Sendable, CustomTestStringConvertible {
        let text: String
        let parsed: ParsedSet
        var testDescription: String { text }

        init(_ text: String, _ reps: Int, _ value: Double?, _ unit: WeightUnit?, _ perHand: Bool, _ note: String?) {
            self.text = text
            parsed = ParsedSet(reps: reps, weightValue: value, unit: unit, perHand: perHand, note: note)
        }
    }

    private static let cases: [Case] = [
        Case("8 x 255", 8, 255.0, nil, false, nil),
        Case("10 @ 45", 10, 45, nil, false, nil),
        Case("8 @ 25lb", 8, 25, .lb, false, nil),
        Case("10x 25lb both arms", 10, 25, .lb, true, nil),
        Case("10 x 27.5lb both arms", 10, 27.5, .lb, true, nil),
        Case("8 x 2x 65lb", 8, 65, .lb, true, nil),
        Case("8 x 2x65lb", 8, 65, .lb, true, nil),
        Case("10x 1x 40 each hand", 10, 40, nil, true, nil),
        Case("12 x 1x 35", 12, 35, nil, false, nil),
        Case("8", 8, nil, nil, false, nil),
        Case("10 reps", 10, nil, nil, false, nil),
        Case("15 x 75lb", 15, 75, .lb, false, nil),
        Case("6 x 140 DEEP SQUAT", 6, 140, nil, false, "DEEP SQUAT"),
        Case("10 @ 30 the right weight", 10, 30, nil, false, "the right weight"),
        Case("8 x 2x 45lb slower descent (3 seconds)", 8, 45, .lb, true, "slower descent (3 seconds)"),
        Case("9 @ 20lb - didn't do it", 9, 20, .lb, false, "didn't do it"),
        Case("5 x 100kg", 5, 100, .kg, false, nil),
        Case("6 × 52.5 kgs", 6, 52.5, .kg, false, nil),
        Case("7 x 50*2", 7, 50, nil, true, nil),
    ]

    @Test(arguments: cases)
    private func parses(_ testCase: Case) {
        #expect(SetLineParser.parse(testCase.text) == testCase.parsed)
    }

    @Test func perSideIsItsOwnFlag() throws {
        let parsed = try #require(SetLineParser.parse("5 x 70 per side"))
        #expect(parsed.perSide && !parsed.perHand)
        #expect(parsed.note == nil)
    }

    @Test(arguments: ["", "Overhead db press", "x 10", "@ 45", "8.5 x 40", "💪"])
    func rejectsLinesWithoutLeadingReps(text: String) {
        #expect(SetLineParser.parse(text) == nil)
    }
}
