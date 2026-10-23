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

    /// The plates for `target` the way a lifter loads them: as many of the heaviest plate as fit, then the next size
    /// down (255 lb is 45 + 45 + 10 + 5 a side, not 45 + 35 + 25). Falls back to `load(for:using:)` when that does not
    /// make the target exactly, as when a size has run out.
    public static func stacked(for target: Weight, using set: PlateSet? = nil) -> PlateLoad {
        let set = set ?? .standard(target.unit)
        let fresh = load(for: target, using: set)
        guard fresh.isExact else { return fresh }
        var left = (target.converted(to: set.unit).value - set.bar) / 2
        var perSide: [Double] = []
        for stock in set.stock.sorted(by: { $0.size > $1.size }) where stock.size > 0 && stock.pairs != 0 {
            var count = Int(((left + tolerance) / stock.size).rounded(.down))
            if let pairs = stock.pairs { count = min(count, pairs) }
            perSide += Array(repeating: stock.size, count: max(0, count))
            left -= Double(max(0, count)) * stock.size
        }
        return abs(left) < tolerance ? PlateLoad(perSide: perSide, total: fresh.total, isExact: true) : fresh
    }

    /// Rounding slack for sums of plate sizes such as 1.25.
    private static let tolerance = 1e-6
}
