import Foundation
import Testing

@testable import LiftCore

@Suite struct OneRepMaxTests {
    @Test(arguments: [
        (5, OneRepMax.Formula.epley, 116.667),
        (5, .brzycki, 112.5),
        (10, .epley, 133.333),
        (10, .brzycki, 133.333),
        (12, .epley, 140),
        (1, .epley, 100),
        (1, .brzycki, 100),
    ])
    func estimates(reps: Int, formula: OneRepMax.Formula, expected: Double) throws {
        let estimate = try #require(OneRepMax.estimate(reps: reps, weight: .lb(100), formula: formula))
        #expect(abs(estimate.value - expected) < 0.001)
        #expect(estimate.unit == .lb)
    }

    @Test(arguments: [(0, 100.0), (-3, 100), (13, 100), (20, 100), (5, 0), (5, -20)])
    func isNilWhenUnreliable(reps: Int, weight: Double) {
        for formula in OneRepMax.Formula.allCases {
            #expect(OneRepMax.estimate(reps: reps, weight: .kg(weight), formula: formula) == nil)
        }
    }

    @Test func bodyweightNeedsAddedLoad() throws {
        let plain = TestCalendar.done(8, nil)
        #expect(OneRepMax.estimate(set: plain, loadMode: .bodyweight(added: nil)) == nil)
        let belt = try #require(OneRepMax.estimate(set: plain, loadMode: .bodyweight(added: .lb(30))))
        #expect(abs(belt.value - 38) < 0.001)
        let logged = try #require(
            OneRepMax.estimate(set: TestCalendar.done(5, .lb(30)), loadMode: .bodyweight(added: nil))
        )
        #expect(abs(logged.value - 35) < 0.001)
    }

    @Test func ignoresWarmUpsSkippedAndMissingWeights() {
        #expect(OneRepMax.estimate(set: TestCalendar.done(5, .lb(95), kind: .warmUp), loadMode: .total) == nil)
        let skipped = LoggedSet(id: TestCalendar.id(1), actual: SetActual(reps: 5, weight: .lb(95)), isSkipped: true)
        #expect(OneRepMax.estimate(set: skipped, loadMode: .total) == nil)
        #expect(OneRepMax.estimate(set: TestCalendar.done(5, nil), loadMode: .total) == nil)
    }

    @Test func bestComparesAcrossUnits() throws {
        let sets = [TestCalendar.done(5, .lb(100)), TestCalendar.done(5, .kg(50)), TestCalendar.done(15, .kg(80))]
        let best = try #require(OneRepMax.best(in: sets, loadMode: .total))
        #expect(best.unit == .kg)
        #expect(abs(best.value - 58.333) < 0.001)
        #expect(OneRepMax.best(in: [], loadMode: .total) == nil)
    }
}
