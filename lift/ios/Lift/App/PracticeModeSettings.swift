import Foundation

/// Whether Lift opens practice data (sample workouts in their own database) instead of the person's log. It stays on
/// this iPhone, so a relaunch, also one a Live Activity button starts in the background, opens the same data.
protocol PracticeModeSetting: AnyObject {
    var isOn: Bool { get set }
}

/// `PracticeModeSetting` in UserDefaults; off until turned on in Settings.
final class UserDefaultsPracticeModeSettings: PracticeModeSetting {
    private static let key = "practice.isOn"
    private let defaults: UserDefaults

    init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    /// The app's standard defaults: the only place this setting touches `UserDefaults.standard` (DI-3).
    static func standard() -> UserDefaultsPracticeModeSettings {
        UserDefaultsPracticeModeSettings(defaults: UserDefaults.standard)
    }

    var isOn: Bool {
        get { defaults.bool(forKey: Self.key) }
        set { defaults.set(newValue, forKey: Self.key) }
    }
}

/// `PracticeModeSetting` for tests: held in memory, never saved.
final class InMemoryPracticeModeSettings: PracticeModeSetting {
    var isOn: Bool

    init(_ isOn: Bool) {
        self.isOn = isOn
    }
}

/// Turns practice mode on or off. Settings' switch calls it; `AppLauncher` reopens the app's data in answer.
protocol PracticeModeSwitching: AnyObject {
    func setPracticeMode(_ isOn: Bool)
}
