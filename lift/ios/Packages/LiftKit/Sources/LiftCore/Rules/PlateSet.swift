import Foundation

/// A bar and the plate sizes available for it, all in one unit.
public struct PlateSet: Hashable, Sendable {
    public var unit: WeightUnit
    public var bar: Double
    /// Plate sizes (one of each pair), any order. Each size is assumed to be available in pairs without limit.
    public var plates: [Double]

    public init(unit: WeightUnit, bar: Double, plates: [Double]) {
        self.unit = unit
        self.bar = bar
        self.plates = plates
    }

    /// A 45 lb bar with 45/35/25/10/5/2.5, or a 20 kg bar with 25/20/15/10/5/2.5/1.25.
    public static func standard(_ unit: WeightUnit) -> PlateSet {
        switch unit {
        case .lb: PlateSet(unit: .lb, bar: 45, plates: [45, 35, 25, 10, 5, 2.5])
        case .kg: PlateSet(unit: .kg, bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25])
        }
    }
}
