import Foundation

/// Whether finished workouts go to Apple Health: the one Health preference, kept on this iPhone. On until the person
/// turns it off (in Settings, or "Not now" on the first summary).
protocol HealthSettingsStoring: AnyObject {
    var savesWorkouts: Bool { get set }
}

/// `HealthSettingsStoring` in UserDefaults: the only type that touches `UserDefaults.standard` (DI-3).
final class UserDefaultsHealthSettings: HealthSettingsStoring {
    private static let key = "health.savesWorkouts"
    private let defaults: UserDefaults

    init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    /// The app's standard defaults.
    static func standard() -> UserDefaultsHealthSettings {
        UserDefaultsHealthSettings(defaults: UserDefaults.standard)
    }

    var savesWorkouts: Bool {
        get { defaults.object(forKey: Self.key) as? Bool ?? true }
        set { defaults.set(newValue, forKey: Self.key) }
    }
}
