import Foundation
import Testing

@testable import LiftCore

/// Plate loading when the gym has only so many pairs of each size: exact, where heaviest-first (greedy) loading
/// would fall short.
@Suite struct PlateLimitsTests {
    private static func set(_ stock: [(Double, Int?)], bar: Double = 20) -> PlateSet {
        PlateSet(unit: .kg, bar: bar, stock: stock.map { PlateSet.Stock(size: $0.0, pairs: $0.1) })
    }

    /// Heaviest plate first while it fits and while pairs are left, as a person loads by hand.
    private static func greedy(_ target: Double, _ set: PlateSet) -> [Double] {
        var left = (target - set.bar) / 2
        var plates: [Double] = []
        for stock in set.stock.sorted(by: { $0.size > $1.size }) {
            var used = 0
            while stock.size <= left + 1e-9, used < (stock.pairs ?? .max) {
                plates.append(stock.size)
                left -= stock.size
                used += 1
            }
        }
        return plates
    }

    @Test func oneTwentyFivePairAndTwentiesMakeOneHundred() {
        let gym = Self.set([(25, 1), (20, 2)])
        #expect(Self.greedy(100, gym) == [25])  // 70 kg: greedy cannot finish
        let load = PlateMath.load(for: .kg(100), using: gym)
        #expect(load.perSide == [20, 20])
        #expect(load.isExact)
    }

    @Test func pairCountsCapEachSize() {
        let gym = Self.set([(20, 2), (10, 1), (5, 1)])
        let load = PlateMath.load(for: .kg(140), using: gym)
        #expect(load.perSide == [20, 20, 10, 5])
        #expect(load.total == .kg(130))
        #expect(!load.isExact)
    }

    @Test(arguments: [
        (100.0, [25.0, 15], true),  // fewest plates, heavier first
        (120, [25, 20, 5], true),  // one pair of 25s: not 25 + 25
        (145, [25, 20, 15, 1.25], false),  // no 2.5s: 142.5 is the most below
    ])
    func choosesTheFewestPlatesWithinTheCounts(target: Double, plates: [Double], exact: Bool) {
        let gym = Self.set([(25, 1), (20, 2), (15, 1), (5, 1), (1.25, 1)])
        let load = PlateMath.load(for: .kg(target), using: gym)
        #expect(load.perSide == plates)
        #expect(load.isExact == exact)
    }

    @Test func aSizeWithNoPairsIsLeftOut() {
        let gym = Self.set([(20, 0), (10, nil)])
        #expect(PlateMath.load(for: .kg(60), using: gym).perSide == [10, 10])
        #expect(gym.pairStep == 20)
    }

    @Test func nearestStaysWithinTheCounts() {
        let gym = Self.set([(20, 1), (5, 1)])
        #expect(PlateMath.nearestLoadable(to: .kg(63), using: gym).total == .kg(60))
        #expect(PlateMath.nearestLoadable(to: .kg(78), using: gym).total == .kg(70))
        #expect(PlateMath.load(for: .kg(200), using: gym).total == .kg(70))  // all the plates there are
    }

    @Test func collarsCountInTheBar() {
        let gym = Self.set([(20, nil), (2.5, nil)], bar: 25)  // a 20 kg bar with 2.5 kg collars
        let load = PlateMath.load(for: .kg(70), using: gym)
        #expect(load.perSide == [20, 2.5])
        #expect(load.isExact)
    }
}
