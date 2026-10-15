import Foundation

/// The unit a weight is written in. Stamped on every logged row (DATA-6).
public enum WeightUnit: String, Codable, Hashable, Sendable, CaseIterable {
    case lb
    case kg

    /// Pounds in one kilogram (exact by definition).
    public static let poundsPerKilogram = 1 / 0.453_592_37

    /// Converts a raw value written in this unit into `other`.
    public func convert(_ value: Double, to other: WeightUnit) -> Double {
        switch (self, other) {
        case (.lb, .lb), (.kg, .kg): value
        case (.kg, .lb): value * Self.poundsPerKilogram
        case (.lb, .kg): value / Self.poundsPerKilogram
        }
    }
}
