import Foundation

/// The numbers a chart's VoiceOver summary reads: the first, last, lowest and highest value, and the direction.
nonisolated struct SeriesSummary: Equatable, Sendable {
    /// Which way the series moved from its first value to its last.
    enum Direction: Equatable, Sendable { case up, down, flat }

    let first: Double
    let last: Double
    let low: Double
    let high: Double
    let direction: Direction
}

/// Pure chart maths (domains, nearest points, ticks, spans), tested without rendering.
nonisolated enum ChartMath {
    /// The summary of `values`, or `nil` when there are none. Non-finite values are skipped. A change smaller than
    /// `flatTolerance` of the range reads as flat.
    static func summary(_ values: [Double], flatTolerance: Double = 0.02) -> SeriesSummary? {
        let finite = values.filter(\.isFinite)
        guard let first = finite.first, let last = finite.last, let low = finite.min(), let high = finite.max() else {
            return nil
        }
        let span = high - low
        let change = last - first
        let direction: SeriesSummary.Direction =
            span == 0 || abs(change) <= span * flatTolerance ? .flat : (change > 0 ? .up : .down)
        return SeriesSummary(first: first, last: last, low: low, high: high, direction: direction)
    }

    /// The index of the position nearest `target` in ascending `positions` (binary search); ties go to the earlier one.
    static func nearestIndex(in positions: [Double], to target: Double) -> Int? {
        guard !positions.isEmpty, target.isFinite else { return nil }
        var low = 0
        var high = positions.count - 1
        while low < high {
            let mid = (low + high) / 2
            if positions[mid] < target { low = mid + 1 } else { high = mid }
        }
        guard low > 0 else { return 0 }
        return abs(positions[low - 1] - target) <= abs(positions[low] - target) ? low - 1 : low
    }

    /// A y domain that holds every value, padded by `padding` of its span on each side so lines never touch the edges.
    /// A flat or single value gets a span of 1 around it; no values give `0...1`.
    static func domain(_ values: [Double], padding: Double = 0.08, includesZero: Bool = false) -> ClosedRange<Double> {
        let finite = values.filter(\.isFinite) + (includesZero ? [0] : [])
        guard let low = finite.min(), let high = finite.max() else { return 0...1 }
        guard high > low else { return (low - 0.5)...(high + 0.5) }
        let pad = (high - low) * padding
        let lower = includesZero && low >= 0 ? low : low - pad
        let upper = includesZero && high <= 0 ? high : high + pad
        return lower...upper
    }

    /// Tick values for a logarithmic axis: 1, 2 and 5 of each decade inside `lower...upper`, thinned evenly to at most
    /// `maxCount`, always keeping the first and last.
    static func logTicks(lower: Double, upper: Double, maxCount: Int = 6) -> [Double] {
        guard lower > 0, upper > lower, maxCount > 0 else { return [] }
        var ticks: [Double] = []
        var decade = pow(10, floor(log10(lower)))
        while decade <= upper {
            for step in [1.0, 2, 5] where (lower...upper).contains(decade * step) {
                ticks.append(decade * step)
            }
            decade *= 10
        }
        return thinned(ticks, to: maxCount)
    }

    /// At most `maxCount` items picked evenly from `items`, keeping the first and the last.
    static func thinned<T>(_ items: [T], to maxCount: Int) -> [T] {
        guard maxCount > 0 else { return [] }
        guard items.count > maxCount, maxCount > 1 else { return Array(items.prefix(maxCount)) }
        let stride = Double(items.count - 1) / Double(maxCount - 1)
        return (0..<maxCount).map { items[Int((Double($0) * stride).rounded())] }
    }

    /// Evenly spaced indices into `count` items, at most `maxCount`, always including the last (the newest period),
    /// so axis labels sit at a steady rhythm: 10 items, at most 6 → 1, 3, 5, 7, 9.
    static func strideIndices(count: Int, maxCount: Int) -> [Int] {
        guard count > 0, maxCount > 0 else { return [] }
        let step = (count + maxCount - 1) / maxCount
        return Array(stride(from: count - 1, through: 0, by: -step).reversed())
    }

    /// The index of the first occurrence of each distinct key, in order: `["a", "b", "a"]` gives `[0, 1]`.
    static func firstIndices(of keys: [String]) -> [Int] {
        var seen = Set<String>()
        return keys.indices.filter { seen.insert(keys[$0]).inserted }
    }

    /// At most about `maxCount` indices into `values` that keep the shape: the first and the last, and in each of the
    /// buckets between them the index of the lowest and of the highest value, in order. Peaks and dips survive, which
    /// an even stride would drop. Fewer values than `maxCount` give every index.
    static func extremaIndices(_ values: [Double], maxCount: Int) -> [Int] {
        guard values.count > maxCount, maxCount >= 4 else { return Array(values.indices) }
        let buckets = (maxCount - 2) / 2
        let inner = 1..<(values.count - 1)
        var picked: Set<Int> = [0, values.count - 1]
        for bucket in 0..<buckets {
            let lower = inner.lowerBound + inner.count * bucket / buckets
            let upper = inner.lowerBound + inner.count * (bucket + 1) / buckets
            guard lower < upper else { continue }
            let slice = lower..<upper
            if let low = slice.min(by: { values[$0] < values[$1] }) { picked.insert(low) }
            if let high = slice.max(by: { values[$0] < values[$1] }) { picked.insert(high) }
        }
        return picked.sorted()
    }

    /// Each width laid end to end from zero: `[2, 3]` becomes `[0..<2, 2..<5]`. Negative and non-finite widths count
    /// as zero.
    static func spans(widths: [Double]) -> [Range<Double>] {
        var start = 0.0
        return widths.map { width in
            let end = start + (width.isFinite ? max(width, 0) : 0)
            defer { start = end }
            return start..<end
        }
    }

    /// The mean of the finite values, or `nil` when there are none.
    static func mean(_ values: [Double]) -> Double? {
        let finite = values.filter(\.isFinite)
        guard !finite.isEmpty else { return nil }
        return finite.reduce(0, +) / Double(finite.count)
    }

    /// `value` as a fraction of `scaleMax`, clamped to 0...1. A scale of zero or less gives 0.
    static func fraction(_ value: Double, of scaleMax: Double) -> Double {
        guard scaleMax > 0, value.isFinite else { return 0 }
        return min(max(value / scaleMax, 0), 1)
    }
}

extension ClosedRange where Bound == Double {
    /// The bounds high to low, the domain a chart scale takes for an axis that runs down.
    nonisolated var reversed: [Double] { [upperBound, lowerBound] }
}
