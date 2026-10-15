import Foundation
import Testing

@testable import LiftCore

@Suite struct SupersetRoundTests {
    @Test func splitsARoundIntoMembers() throws {
        let line = "lateral raise 12 @ 15 + curls 10 @ 25 + OH triceps 10 @ 45, 60s between rounds"
        let round = try #require(SupersetRound.parse(line))
        #expect(round.members.map(\.name) == ["lateral raise", "curls", "OH triceps"])
        #expect(round.members.map(\.set.reps) == [12, 10, 10])
        #expect(round.members.map(\.set.weightValue) == [15, 25, 45])
        #expect(round.restSeconds == 60)
        #expect(round.note == nil)
        #expect(round.keys == ["lateral raise", "curl", "overhead tricep"])
    }

    @Test func keepsTrailingTextThatIsNotRest() throws {
        let round = try #require(SupersetRound.parse("face pull 15 x 30 + reverse fly 12 x 10lb, grip gave out"))
        #expect(round.members.count == 2)
        #expect(round.members[1].set.unit == .lb)
        #expect(round.restSeconds == nil)
        #expect(round.note == "grip gave out")
    }

    @Test(arguments: [
        "lateral raise 12 @ 15",
        "20 mins stairclimbers += 100 flights",
        "curls + raises",
        "curls 10 @ 25 + ",
        "8 x 100 + 8 x 100",
    ])
    func rejectsLinesThatAreNotRounds(line: String) {
        #expect(SupersetRound.parse(line) == nil)
    }
}
