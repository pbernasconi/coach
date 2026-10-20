import Foundation

/// Where a value sits against a target band.
nonisolated public enum BandPosition: Equatable, Sendable {
    case below, within, above

    /// The position of `value` against `band`; within when there is no band.
    public init(_ value: Double, band: ClosedRange<Double>?) {
        guard let band else {
            self = .within
            return
        }
        self = value < band.lowerBound ? .below : (value > band.upperBound ? .above : .within)
    }
}

/// Pure maths for shares of a whole (zone bars): whole percentages that add up to 100.
nonisolated enum ShareMath {
    /// Each amount's share of the total as a fraction 0...1. Negative and non-finite amounts count as zero; a zero
    /// total gives all zeros.
    static func fractions(_ amounts: [Double]) -> [Double] {
        let clean = amounts.map { $0.isFinite ? max($0, 0) : 0 }
        let total = clean.reduce(0, +)
        guard total > 0 else { return clean.map { _ in 0 } }
        return clean.map { $0 / total }
    }

    /// Whole percentages that add up to exactly 100 (largest remainder), so a list never reads "99%" or "101%" in total.
    /// A zero total gives all zeros.
    static func percentages(_ amounts: [Double]) -> [Int] {
        let exact = fractions(amounts).map { $0 * 100 }
        guard exact.contains(where: { $0 > 0 }) else { return exact.map { _ in 0 } }
        var whole = exact.map { Int($0.rounded(.down)) }
        let missing = 100 - whole.reduce(0, +)
        let byRemainder = exact.indices.sorted { lhs, rhs in
            let left = exact[lhs] - Double(whole[lhs])
            let right = exact[rhs] - Double(whole[rhs])
            return left == right ? lhs < rhs : left > right
        }
        for index in byRemainder.prefix(missing) { whole[index] += 1 }
        return whole
    }
}
