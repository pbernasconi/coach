import Foundation

/// Which plates make a barbell weight. Uses the fewest plates for each reachable total.
public enum PlateMath {
    /// The heaviest loadable total at or below `target` (the bar alone if the target is lighter than the bar).
    public static func load(for target: Weight, using set: PlateSet? = nil) -> PlateLoad {
        let solver = Solver(set: set ?? .standard(target.unit), target: target)
        return solver.result(units: solver.downUnits)
    }

    /// The loadable total closest to `target`; a tie goes to the lighter one.
    public static func nearestLoadable(to target: Weight, using set: PlateSet? = nil) -> PlateLoad {
        let solver = Solver(set: set ?? .standard(target.unit), target: target)
        guard let up = solver.upUnits else { return solver.result(units: solver.downUnits) }
        let down = solver.downUnits
        let goal = solver.targetPerSide / solver.unitSize
        return solver.result(units: Double(up) - goal < goal - Double(down) ? up : down)
    }
}

/// Dynamic programming over plate "units" (the greatest common step of the plate sizes).
private struct Solver {
    let set: PlateSet
    let target: Double
    let targetPerSide: Double
    let unitSize: Double
    let plateUnits: [Int]
    /// For each per-side total in units: the index of the last plate added, or nil when unreachable.
    let lastPlate: [Int?]

    init(set: PlateSet, target: Weight) {
        self.set = set
        self.target = target.converted(to: set.unit).value
        targetPerSide = (self.target - set.bar) / 2
        let hundredths = set.plates.map { Int(($0 * 100).rounded()) }.filter { $0 > 0 }.sorted(by: >)
        let step = hundredths.reduce(0) { Self.gcd($0, $1) }
        unitSize = Double(max(step, 1)) / 100
        plateUnits = hundredths.map { $0 / max(step, 1) }
        let goalUnits = max(0, Int((targetPerSide / unitSize).rounded(.up)))
        lastPlate = Self.reachability(limit: goalUnits + (plateUnits.first ?? 0), plates: plateUnits)
    }

    /// Largest reachable per-side total at or below the target.
    var downUnits: Int {
        let limit = min(lastPlate.count - 1, Int((targetPerSide / unitSize + 1e-9).rounded(.down)))
        guard limit > 0 else { return 0 }
        return (0...limit).last { $0 == 0 || lastPlate[$0] != nil } ?? 0
    }

    /// Smallest reachable per-side total at or above the target, if any.
    var upUnits: Int? {
        let start = max(0, Int((targetPerSide / unitSize - 1e-9).rounded(.up)))
        guard start < lastPlate.count else { return nil }
        return (start..<lastPlate.count).first { $0 == 0 || lastPlate[$0] != nil }
    }

    func result(units: Int) -> PlateLoad {
        var plates: [Double] = []
        var remaining = units
        while remaining > 0, let index = lastPlate[remaining] {
            plates.append(Double(plateUnits[index]) * unitSize)
            remaining -= plateUnits[index]
        }
        let total = set.bar + 2 * Double(units) * unitSize
        return PlateLoad(
            perSide: plates.sorted(by: >),
            total: Weight(total, set.unit),
            isExact: abs(total - target) < 1e-6
        )
    }

    private static func reachability(limit: Int, plates: [Int]) -> [Int?] {
        var count = [Int](repeating: Int.max, count: limit + 1)
        var last = [Int?](repeating: nil, count: limit + 1)
        count[0] = 0
        for total in stride(from: 1, through: limit, by: 1) {
            for (index, plate) in plates.enumerated() where plate <= total && count[total - plate] != Int.max {
                if count[total - plate] + 1 < count[total] {
                    count[total] = count[total - plate] + 1
                    last[total] = index
                }
            }
        }
        return last
    }

    private static func gcd(_ a: Int, _ b: Int) -> Int {
        b == 0 ? a : gcd(b, a % b)
    }
}
