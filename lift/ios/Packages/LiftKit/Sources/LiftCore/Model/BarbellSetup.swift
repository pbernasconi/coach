import Foundation

/// One plate size in the gym: whether it is there and how many pairs of it.
public struct GymPlate: Codable, Hashable, Sendable, Identifiable {
    /// The pair counts the person can choose from.
    public static let pairRange = 1...20

    public var size: Double
    public var isAvailable: Bool
    public var pairs: Int

    public var id: Double { size }

    public init(size: Double, isAvailable: Bool, pairs: Int) {
        self.size = size
        self.isAvailable = isAvailable
        self.pairs = pairs
    }
}

/// The barbell kit for one unit: the bar used by default, the plates and the collars.
public struct BarbellSetup: Codable, Hashable, Sendable {
    public var unit: WeightUnit
    /// The default bar's weight; one of `bars(unit)`.
    public var bar: Double
    /// Every plate size the unit offers, heaviest first, each on or off.
    public var plates: [GymPlate]
    /// What one collar weighs; 0 for none (spring clips count as none).
    public var collar: Double

    public init(unit: WeightUnit, bar: Double, plates: [GymPlate], collar: Double) {
        self.unit = unit
        self.bar = bar
        self.plates = plates
        self.collar = collar
    }

    /// The bar weights to choose from.
    public static func bars(_ unit: WeightUnit) -> [Double] {
        switch unit {
        case .kg: [20, 15, 10]
        case .lb: [45, 35, 25, 15]
        }
    }

    /// Collar weights to choose from (each): none, or competition collars.
    public static func collars(_ unit: WeightUnit) -> [Double] {
        switch unit {
        case .kg: [0, 2.5]
        case .lb: [0, 5.5]
        }
    }

    /// A 20 kg bar with 25/20/15/10/5/2.5/1.25, or a 45 lb bar with 45/35/25/10/5/2.5; no collars. The heavy plates
    /// come in 4 pairs (6 of 45 lb), the rest in 2.
    public static func standard(_ unit: WeightUnit) -> BarbellSetup {
        switch unit {
        case .kg:
            let on: Set<Double> = [25, 20, 15, 10, 5, 2.5, 1.25]
            let sizes: [Double] = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5]
            let plates = sizes.map { GymPlate(size: $0, isAvailable: on.contains($0), pairs: $0 >= 20 ? 4 : 2) }
            return BarbellSetup(unit: .kg, bar: 20, plates: plates, collar: 0)
        case .lb:
            let on: Set<Double> = [45, 35, 25, 10, 5, 2.5]
            let sizes: [Double] = [55, 45, 35, 25, 15, 10, 5, 2.5, 1.25]
            let plates = sizes.map { GymPlate(size: $0, isAvailable: on.contains($0), pairs: $0 == 45 ? 6 : 2) }
            return BarbellSetup(unit: .lb, bar: 45, plates: plates, collar: 0)
        }
    }

    /// The empty bar with its collars on.
    public var emptyBar: Double { bar + 2 * collar }

    /// The plates that are on, with their pair counts, for `PlateMath`.
    public var plateSet: PlateSet {
        let stock = plates.filter(\.isAvailable).map { PlateSet.Stock(size: $0.size, pairs: $0.pairs) }
        return PlateSet(unit: unit, bar: emptyBar, stock: stock)
    }
}
