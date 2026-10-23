import Foundation
import Testing

@testable import LiftCore

@Suite struct PlateChangeTests {
    @Test(arguments: [
        ([45.0, 45], [45.0, 45, 10, 5], [45.0, 45], [Double](), [10.0, 5]),
        ([45, 45, 10, 5], [45, 45], [45, 45], [10, 5], []),
        ([45, 45, 10, 5], [45, 45, 25], [45, 45], [10, 5], [25]),
        ([45, 25], [45, 25], [45, 25], [], []),
        ([Double](), [45], [], [], [45]),
        ([45], [], [], [45], []),
        ([25], [45], [], [25], [45]),
    ])
    func changesFromTheOutsideIn(from: [Double], to: [Double], kept: [Double], remove: [Double], add: [Double]) {
        let change = PlateChange(from: from, to: to)
        #expect(change.kept == kept)
        #expect(change.remove == remove)
        #expect(change.add == add)
    }

    @Test func noChangeWhenTheBarAlreadyHoldsTheLoad() {
        #expect(PlateChange(from: [45, 10], to: [45, 10]).isNone)
        #expect(!PlateChange(from: [45], to: [45, 10]).isNone)
    }
}

@Suite struct PlateMathFromTests {
    static let keeping: [(onBar: [Double], target: Double, plates: [Double])] = [
        ([45, 45], 255, [45, 45, 10, 5]),
        ([45, 45, 10, 5], 225, [45, 45]),
        ([45], 225, [45, 45]),
        ([45, 45], 135, [45]),
        ([], 255, [45, 35, 25]),
        ([45, 45, 10, 5], 275, [45, 45, 10, 5, 10]),
    ]

    @Test(arguments: keeping)
    func keepsThePlatesOnTheBar(onBar: [Double], target: Double, plates: [Double]) {
        let load = PlateMath.load(for: .lb(target), from: onBar)
        #expect(load.perSide == plates)
        #expect(load.total == .lb(target))
        #expect(load.isExact)
    }

    @Test func fallsBackWhenTheTargetCannotBeMadeExactly() {
        let load = PlateMath.load(for: .lb(252), from: [45, 45])
        #expect(load == PlateMath.load(for: .lb(252)))
        #expect(!load.isExact)
    }

    @Test func respectsHowManyPairsThereAre() {
        let set = PlateSet(unit: .lb, bar: 45, stock: [.init(size: 45, pairs: 2), .init(size: 25, pairs: 2)])
        let load = PlateMath.load(for: .lb(275), using: set, from: [45, 25])
        #expect(load.perSide == [45, 25, 45])
        #expect(load.isExact)
    }
}
