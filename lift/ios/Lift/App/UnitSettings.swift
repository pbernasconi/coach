import Foundation
import LiftCore

/// The weight unit the person prefers: new sessions and templates use it, and screens that convert show loads in it.
/// It stays on this iPhone and does not sync: every session and set is stamped with the unit it was logged in
/// (`unitsAtLog`, DATA-6), so changing it never reinterprets history, and the web dashboard converts per row.
protocol UnitPreference: AnyObject {
    var unit: WeightUnit { get set }
}

/// `UnitPreference` in UserDefaults; until the person picks one, the locale's (lb in the US, kg elsewhere).
final class UserDefaultsUnitSettings: UnitPreference {
    private static let key = "units.weight"
    private let defaults: UserDefaults
    private let fallback: WeightUnit

    init(defaults: UserDefaults, fallback: WeightUnit) {
        self.defaults = defaults
        self.fallback = fallback
    }

    /// The app's standard defaults: the only place this preference touches `UserDefaults.standard` (DI-3).
    static func standard(fallback: WeightUnit) -> UserDefaultsUnitSettings {
        UserDefaultsUnitSettings(defaults: UserDefaults.standard, fallback: fallback)
    }

    var unit: WeightUnit {
        get { defaults.string(forKey: Self.key).flatMap(WeightUnit.init(rawValue:)) ?? fallback }
        set { defaults.set(newValue.rawValue, forKey: Self.key) }
    }
}

/// `UnitPreference` for demo and `-fresh` data, and for tests: held in memory, never saved.
final class InMemoryUnitSettings: UnitPreference {
    var unit: WeightUnit

    init(_ unit: WeightUnit) {
        self.unit = unit
    }
}
