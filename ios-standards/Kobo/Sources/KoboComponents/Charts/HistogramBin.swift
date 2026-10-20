import Foundation

/// One bar of a `KoboHistogram`: how many values fell in `lower..<upper`.
nonisolated public struct HistogramBin: Identifiable, Equatable, Hashable, Sendable {
    public let lower: Double
    public let upper: Double
    public let count: Int

    public var id: Double { lower }

    public init(lower: Double, upper: Double, count: Int) {
        self.lower = lower
        self.upper = upper
        self.count = count
    }

    /// Values grouped into bins of `width`, aligned to multiples of `width` (so 0–5, 5–10…), with every empty bin
    /// between the first and the last kept so gaps show. Non-finite values are skipped; a width of zero or less gives
    /// no bins.
    ///
    ///     HistogramBin.bins([3, 4, 12], width: 5)   // [0–5: 2, 5–10: 0, 10–15: 1]
    public static func bins(_ values: [Double], width: Double) -> [HistogramBin] {
        let finite = values.filter(\.isFinite)
        guard width > 0, let low = finite.min(), let high = finite.max() else { return [] }
        let first = Int((low / width).rounded(.down))
        let last = Int((high / width).rounded(.down))
        var counts = [Int](repeating: 0, count: last - first + 1)
        for value in finite {
            counts[Int((value / width).rounded(.down)) - first] += 1
        }
        return counts.enumerated().map { offset, count in
            let lower = Double(first + offset) * width
            return HistogramBin(lower: lower, upper: lower + width, count: count)
        }
    }

    /// The bin holding the most values (the first of equals), or `nil` for no bins.
    static func mode(of bins: [HistogramBin]) -> HistogramBin? {
        bins.reduce(nil) { best, bin in
            guard let best else { return bin }
            return bin.count > best.count ? bin : best
        }
    }
}
