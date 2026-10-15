import Foundation
import Testing

@testable import LiftCore

@Suite struct PlateMathTests {
    @Test(arguments: [
        (225.0, [45.0, 45], 225.0, true),
        (135, [45], 135, true),
        (45, [], 45, true),
        (187, [45, 25], 185, false),
        (317.5, [45, 45, 45], 315, false),
        (142.5, [45, 2.5], 140, false),
        (30, [], 45, false),
        (0, [], 45, false),
        (-100, [], 45, false),
    ])
    func loadsPoundsRoundingDown(target: Double, plates: [Double], total: Double, exact: Bool) {
        let load = PlateMath.load(for: .lb(target))
        #expect(load.perSide == plates)
        #expect(load.total == .lb(total))
        #expect(load.isExact == exact)
    }

    @Test(arguments: [
        (100.0, [25.0, 15], 100.0, true),
        (61.25, [20], 60, false),
        (142.5, [25, 25, 10, 1.25], 142.5, true),
        (20, [], 20, true),
    ])
    func loadsKilograms(target: Double, plates: [Double], total: Double, exact: Bool) {
        let load = PlateMath.load(for: .kg(target))
        #expect(load.perSide == plates)
        #expect(load.total == .kg(total))
        #expect(load.isExact == exact)
    }

    @Test func convertsTheTargetIntoThePlateUnit() {
        let load = PlateMath.load(for: .kg(100), using: .standard(.lb))
        #expect(load.total == .lb(220))
        #expect(load.perSide == [45, 35, 5, 2.5])
    }

    @Test func findsCombinationsGreedyWouldMiss() {
        let odd = PlateSet(unit: .lb, bar: 45, plates: [35, 25])
        let load = PlateMath.load(for: .lb(145), using: odd)
        #expect(load.perSide == [25, 25])
        #expect(load.isExact)
    }

    @Test(arguments: [(94.5, 95.0), (67.5, 65), (61.25, 60), (46, 45), (10, 45), (157.6, 160)])
    func nearestLoadablePrefersCloserThenLighter(target: Double, expected: Double) {
        #expect(PlateMath.nearestLoadable(to: .lb(target)).total == .lb(expected))
    }

    @Test func noPlatesMeansJustTheBar() {
        let bare = PlateSet(unit: .kg, bar: 15, plates: [])
        #expect(PlateMath.load(for: .kg(60), using: bare) == PlateLoad(perSide: [], total: .kg(15), isExact: false))
        #expect(PlateMath.nearestLoadable(to: .kg(60), using: bare).total == .kg(15))
    }
}
