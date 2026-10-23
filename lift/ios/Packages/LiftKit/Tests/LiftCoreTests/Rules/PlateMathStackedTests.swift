import Foundation
import Testing

@testable import LiftCore

@Suite struct PlateMathStackedTests {
    static let loads: [(target: Double, plates: [Double])] = [
        (255, [45, 45, 10, 5]),
        (225, [45, 45]),
        (135, [45]),
        (145, [45, 5]),
        (140, [45, 2.5]),
        (45, []),
    ]

    @Test(arguments: loads)
    func loadsTheHeaviestPlatesFirst(target: Double, plates: [Double]) {
        let load = PlateMath.stacked(for: .lb(target))
        #expect(load.perSide == plates)
        #expect(load.total == .lb(target))
        #expect(load.isExact)
    }

    @Test func usesOnlyThePairsThereAre() {
        let set = PlateSet(unit: .lb, bar: 45, stock: [.init(size: 45, pairs: 1), .init(size: 25), .init(size: 5)])
        #expect(PlateMath.stacked(for: .lb(255), using: set).perSide == [45, 25, 25, 5, 5])
    }

    @Test func fallsBackWhenStackingCannotMakeTheTarget() {
        let set = PlateSet(unit: .kg, bar: 20, stock: [.init(size: 25), .init(size: 20)])
        let load = PlateMath.stacked(for: .kg(100), using: set)
        #expect(load == PlateMath.load(for: .kg(100), using: set))
        #expect(load.perSide == [20, 20])
    }

    @Test func fallsBackWhenTheTargetCannotBeMadeExactly() {
        let load = PlateMath.stacked(for: .lb(252))
        #expect(load == PlateMath.load(for: .lb(252)))
        #expect(!load.isExact)
    }
}
