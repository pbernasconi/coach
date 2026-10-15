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
}
