import Foundation

/// Which plates make a barbell weight, within the pairs the gym has. Exact, not greedy: it finds a load whenever one
/// exists (25 + 15 when the 20s are out, 20 + 20 when there is one pair of 25s), using the fewest plates and, among
/// those, the heaviest first.
public enum PlateMath {
    /// The heaviest loadable total at or below `target` (the bar alone if the target is lighter than the bar).
    public static func load(for target: Weight, using set: PlateSet? = nil) -> PlateLoad {
        let solver = PlateSolver(set: set ?? .standard(target.unit), target: target)
        return solver.result(units: solver.downUnits)
    }

    /// The loadable total closest to `target`; a tie goes to the lighter one.
    public static func nearestLoadable(to target: Weight, using set: PlateSet? = nil) -> PlateLoad {
        let solver = PlateSolver(set: set ?? .standard(target.unit), target: target)
        guard let up = solver.upUnits else { return solver.result(units: solver.downUnits) }
        let down = solver.downUnits
        let goal = solver.targetPerSide / solver.unitSize
        return solver.result(units: Double(up) - goal < goal - Double(down) ? up : down)
    }

    /// The plates for `target` that keep as many of the plates on the bar now (`onBar`, one side, from the collar
    /// outwards) as can stay: going from 45 + 45 to 255 lb adds 10 + 5 rather than swapping to 45 + 35 + 25. Falls back
    /// to `load(for:using:)` when no load that keeps plates makes the target exactly.
    public static func load(for target: Weight, using set: PlateSet? = nil, from onBar: [Double]) -> PlateLoad {
        let set = set ?? .standard(target.unit)
        let fresh = load(for: target, using: set)
        guard fresh.isExact else { return fresh }
        let perSide = (target.converted(to: set.unit).value - set.bar) / 2
        for kept in stride(from: onBar.count, through: 1, by: -1) {
            let stay = Array(onBar.prefix(kept))
            let rest = perSide - stay.reduce(0, +)
            guard rest >= 0, let left = set.removing(stay) else { continue }
            let unloaded = PlateSet(unit: set.unit, bar: 0, stock: left.stock)
            let extra = load(for: Weight(rest * 2, set.unit), using: unloaded)
            if extra.isExact {
                return PlateLoad(perSide: stay + extra.perSide, total: fresh.total, isExact: true)
            }
        }
        return fresh
    }
}

extension PlateSet {
    /// This set with one pair of each of `plates` taken out, or nil when it does not have them.
    func removing(_ plates: [Double]) -> PlateSet? {
        var stock = self.stock
        for plate in plates {
            guard let index = stock.firstIndex(where: { $0.size == plate && $0.pairs != 0 }) else { return nil }
            stock[index].pairs = stock[index].pairs.map { $0 - 1 }
        }
        return PlateSet(unit: unit, bar: bar, stock: stock)
    }
}
