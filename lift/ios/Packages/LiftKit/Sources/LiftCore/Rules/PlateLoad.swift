import Foundation

/// The plates to put on each side of the bar, and the total they make.
public struct PlateLoad: Hashable, Sendable {
    /// Plates for one side, heaviest first.
    public let perSide: [Double]
    /// Bar plus both sides, in the plate set's unit.
    public let total: Weight
    /// True when `total` equals the requested target.
    public let isExact: Bool

    public init(perSide: [Double], total: Weight, isExact: Bool) {
        self.perSide = perSide
        self.total = total
        self.isExact = isExact
    }
}
