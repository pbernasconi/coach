import Foundation

/// The person's gym: a barbell kit per unit. Loads in kg use the kg kit and loads in lb the lb kit, so a session keeps
/// the plates of the unit it was logged in.
public struct GymSetup: Codable, Hashable, Sendable {
    public var kg: BarbellSetup
    public var lb: BarbellSetup

    public init(kg: BarbellSetup, lb: BarbellSetup) {
        self.kg = kg
        self.lb = lb
    }

    /// Made-up defaults until the person lists their own (`BarbellSetup.standard`).
    public static let standard = GymSetup(kg: .standard(.kg), lb: .standard(.lb))

    public subscript(unit: WeightUnit) -> BarbellSetup {
        get { unit == .kg ? kg : lb }
        set {
            switch unit {
            case .kg: kg = newValue
            case .lb: lb = newValue
            }
        }
    }

    /// The bar and plates for loads in `unit`.
    public func plateSet(_ unit: WeightUnit) -> PlateSet {
        self[unit].plateSet
    }

    /// The smallest change a barbell load can make in `unit`: two of the lightest plate that is on, or the barbell's
    /// default increment when no plates are on.
    public func barbellStep(in unit: WeightUnit) -> Double {
        plateSet(unit).pairStep ?? Equipment.barbell.defaultIncrement(in: unit).value
    }

    /// The load increment for progression. A barbell's default increment is rounded up to a whole number of
    /// `barbellStep`s, so the next load can be made with the plates there are; other equipment keeps its default.
    public func increment(for equipment: Equipment?, in unit: WeightUnit) -> Weight {
        let base = (equipment ?? .other).defaultIncrement(in: unit)
        guard equipment == .barbell else { return base }
        let step = barbellStep(in: unit)
        let steps = max(1, (base.value / step - 1e-9).rounded(.up))
        return Weight((steps * step * 1_000).rounded() / 1_000, unit)
    }
}
