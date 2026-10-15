import Foundation

/// Dynamic programming over plate "units" (the greatest common step of the plate sizes) for `PlateMath`, with each
/// size limited to the pairs there are.
struct PlateSolver {
    /// How to make one per-side total: plates used, and how many of each size (heaviest first).
    private struct Choice {
        var plates: Int
        var counts: [Int]

        /// Fewer plates first; with as many plates, more of the heavier sizes.
        func isBetter(than other: Choice?) -> Bool {
            guard let other else { return true }
            if plates != other.plates { return plates < other.plates }
            return counts.lexicographicallyPrecedes(other.counts, by: >)
        }
    }

    let set: PlateSet
    let target: Double
    let targetPerSide: Double
    let unitSize: Double
    /// Plate sizes in units, heaviest first, and how many of each fit on one side.
    private let sizes: [(units: Int, limit: Int?)]
    /// For each per-side total in units: the best way to make it, or nil when it cannot be made.
    private let best: [Choice?]

    init(set: PlateSet, target: Weight) {
        self.set = set
        self.target = target.converted(to: set.unit).value
        targetPerSide = (self.target - set.bar) / 2
        let stock = set.stock
            .map { (hundredths: Int(($0.size * 100).rounded()), pairs: $0.pairs) }
            .filter { $0.hundredths > 0 && $0.pairs != 0 }
            .sorted { $0.hundredths > $1.hundredths }
        let step = max(stock.reduce(0) { Self.gcd($0, $1.hundredths) }, 1)
        unitSize = Double(step) / 100
        sizes = stock.map { (units: $0.hundredths / step, limit: $0.pairs.map { max($0, 0) }) }
        let goalUnits = max(0, Int((targetPerSide / unitSize).rounded(.up)))
        best = Self.solve(limit: goalUnits + (sizes.first?.units ?? 0), sizes: sizes)
    }

    /// Largest reachable per-side total at or below the target.
    var downUnits: Int {
        let limit = min(best.count - 1, Int((targetPerSide / unitSize + 1e-9).rounded(.down)))
        guard limit > 0 else { return 0 }
        return (0...limit).last { best[$0] != nil } ?? 0
    }

    /// Smallest reachable per-side total at or above the target, if any.
    var upUnits: Int? {
        let start = max(0, Int((targetPerSide / unitSize - 1e-9).rounded(.up)))
        guard start < best.count else { return nil }
        return (start..<best.count).first { best[$0] != nil }
    }

    func result(units: Int) -> PlateLoad {
        var plates: [Double] = []
        if let counts = best[units]?.counts {
            for (size, count) in zip(sizes, counts) {
                plates += Array(repeating: Double(size.units) * unitSize, count: count)
            }
        }
        let total = set.bar + 2 * Double(units) * unitSize
        return PlateLoad(
            perSide: plates,
            total: Weight(total, set.unit),
            isExact: abs(total - target) < 1e-6
        )
    }

    /// Bounded change-making: adds one plate size at a time, trying every count up to its limit.
    private static func solve(limit: Int, sizes: [(units: Int, limit: Int?)]) -> [Choice?] {
        var best = [Choice?](repeating: nil, count: limit + 1)
        best[0] = Choice(plates: 0, counts: [])
        for size in sizes {
            var next = [Choice?](repeating: nil, count: limit + 1)
            for total in 0...limit {
                let most = min(size.limit ?? Int.max, total / size.units)
                for count in 0...most {
                    guard let previous = best[total - count * size.units] else { continue }
                    let choice = Choice(plates: previous.plates + count, counts: previous.counts + [count])
                    if choice.isBetter(than: next[total]) { next[total] = choice }
                }
            }
            best = next
        }
        return best
    }

    private static func gcd(_ a: Int, _ b: Int) -> Int {
        b == 0 ? a : gcd(b, a % b)
    }
}
