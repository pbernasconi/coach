import Foundation
import Testing

@testable import LiftCore

@Suite struct ProgressionTests {
    private static func sets(_ reps: [Int], _ weight: Weight? = .lb(100)) -> [LoggedSet] {
        reps.map { TestCalendar.done($0, weight) }
    }

    private static let skipped = LoggedSet(id: TestCalendar.id(9), target: SetTarget(reps: 12), isSkipped: true)

    @Test(arguments: [
        ([12, 12, 12], ProgressionSuggestion.increase(to: .lb(105), targetReps: 8)),
        ([13, 12, 12], .increase(to: .lb(105), targetReps: 8)),
        ([12, 12, 11], .repeatWeight(targetReps: 12)),
        ([12, 9, 8], .repeatWeight(targetReps: 9)),
        ([7, 10, 10], .repeatWeight(targetReps: 8)),
    ])
    func doubleProgression(reps: [Int], expected: ProgressionSuggestion) {
        let increment = Equipment.barbell.defaultIncrement(in: .lb)
        #expect(Progression.suggest(repRange: 8...12, last: Self.sets(reps), increment: increment) == expected)
    }

    @Test func skippedOrFailedSetsBlockTheIncrease() {
        let withSkip = Self.sets([12, 12]) + [Self.skipped]
        #expect(Progression.suggest(repRange: 8...12, last: withSkip, increment: .lb(5)) == .repeatWeight(targetReps: 12))
        let withFailure = Self.sets([12, 12]) + [TestCalendar.done(12, .lb(100), kind: .failure)]
        #expect(Progression.suggest(repRange: 8...12, last: withFailure, increment: .lb(5)) == .repeatWeight(targetReps: 12))
    }

    @Test func warmUpsAndDropSetsAreIgnored() {
        let last = [TestCalendar.done(5, .lb(45), kind: .warmUp)] + Self.sets([12, 12]) + [TestCalendar.done(6, .lb(60), kind: .drop)]
        #expect(Progression.suggest(repRange: 8...12, last: last, increment: .lb(5)) == .increase(to: .lb(105), targetReps: 8))
    }

    @Test func deloadsAfterTwoSessionsBelowTheRange() {
        let last = Self.sets([7, 8, 8], .lb(225))
        let previous = Self.sets([8, 6], .lb(225))
        #expect(Progression.suggest(repRange: 8...12, last: last, previous: previous, increment: .lb(5)) == .deload(to: .lb(200)))
        let kg = Progression.suggest(repRange: 8...12, last: Self.sets([6], .kg(62.5)), previous: Self.sets([7], .kg(62.5)), increment: .kg(2.5))
        #expect(kg == .deload(to: .kg(55)))
    }

    @Test func oneBadSessionIsNotADeload() {
        let previous = Self.sets([10, 10])
        #expect(Progression.suggest(repRange: 8...12, last: Self.sets([7, 7]), previous: previous, increment: .lb(5)) == .repeatWeight(targetReps: 8))
    }

    @Test func incrementIsConvertedToTheLoggedUnit() {
        let suggestion = Progression.suggest(repRange: 5...5, last: Self.sets([5, 5], .kg(60)), increment: .kg(2.5))
        #expect(suggestion == .increase(to: .kg(62.5), targetReps: 5))
    }

    @Test func bodyweightAddsLoadOrRepeats() {
        let top = Progression.suggest(repRange: 6...10, last: Self.sets([10, 10], nil), increment: .lb(5))
        #expect(top == .increase(to: .lb(5), targetReps: 6))
        let low = Progression.suggest(repRange: 6...10, last: Self.sets([4], nil), previous: Self.sets([5], nil), increment: .lb(5))
        #expect(low == .repeatWeight(targetReps: 6))
    }

    @Test func noWorkingSetsMeansNoHistory() {
        #expect(Progression.suggest(repRange: 8...12, last: [], increment: .lb(5)) == .noHistory)
        let warmUps = [TestCalendar.done(10, .lb(45), kind: .warmUp)]
        #expect(Progression.suggest(repRange: 8...12, last: warmUps, increment: .lb(5)) == .noHistory)
        #expect(Progression.suggest(repRange: 8...12, last: [Self.skipped], increment: .lb(5)) == .repeatWeight(targetReps: 8))
    }
}
