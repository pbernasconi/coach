import Foundation

/// A bar and the plates available for it, all in one unit.
public struct PlateSet: Hashable, Sendable {
    /// One plate size and how many pairs of it there are.
    public struct Stock: Hashable, Sendable {
        public var size: Double
        /// Pairs of this size; nil means as many as needed.
        public var pairs: Int?

        public init(size: Double, pairs: Int? = nil) {
            self.size = size
            self.pairs = pairs
        }
    }

    public var unit: WeightUnit
    /// What the bar weighs as loaded before any plates (the bar plus its collars, if any).
    public var bar: Double
    /// The plate sizes (one of each pair) with their counts, any order.
    public var stock: [Stock]

    /// Plate sizes (one of each pair), any order, each available in pairs without limit.
    public init(unit: WeightUnit, bar: Double, plates: [Double]) {
        self.init(unit: unit, bar: bar, stock: plates.map { Stock(size: $0) })
    }

    public init(unit: WeightUnit, bar: Double, stock: [Stock]) {
        self.unit = unit
        self.bar = bar
        self.stock = stock
    }

    /// The plate sizes, any order.
    public var plates: [Double] { stock.map(\.size) }

    /// The smallest change in total the plates allow: two of the lightest plate. Nil without plates.
    public var pairStep: Double? {
        stock.filter { $0.size > 0 && $0.pairs != 0 }.map(\.size).min().map { $0 * 2 }
    }

    /// The default gym's bar and plates for `unit` (`BarbellSetup.standard`).
    public static func standard(_ unit: WeightUnit) -> PlateSet {
        BarbellSetup.standard(unit).plateSet
    }
}
