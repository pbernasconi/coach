import Foundation

/// A load: a number and the unit it was written in.
public struct Weight: Codable, Hashable, Sendable {
    public var value: Double
    public var unit: WeightUnit

    public init(_ value: Double, _ unit: WeightUnit) {
        self.value = value
        self.unit = unit
    }

    public static func lb(_ value: Double) -> Weight { Weight(value, .lb) }
    public static func kg(_ value: Double) -> Weight { Weight(value, .kg) }

    /// The same load expressed in `unit`.
    public func converted(to unit: WeightUnit) -> Weight {
        Weight(self.unit.convert(value, to: unit), unit)
    }

    /// Rounds to a multiple of `step` (in this weight's unit). A step of zero or less returns `self`.
    public func rounded(toStep step: Double, rule: FloatingPointRoundingRule = .toNearestOrAwayFromZero) -> Weight {
        guard step > 0 else { return self }
        let steps = (value / step).rounded(rule)
        return Weight((steps * step * 1_000).rounded() / 1_000, unit)
    }

    /// Rounds to a multiple of `step`, converting `step` into this weight's unit first.
    public func rounded(to step: Weight, rule: FloatingPointRoundingRule = .toNearestOrAwayFromZero) -> Weight {
        rounded(toStep: step.converted(to: unit).value, rule: rule)
    }

    /// Adds `other`, converted into this weight's unit.
    public func adding(_ other: Weight) -> Weight {
        Weight(value + other.converted(to: unit).value, unit)
    }

    /// Multiplies the value, keeping the unit.
    public func scaled(by factor: Double) -> Weight {
        Weight(value * factor, unit)
    }
}
