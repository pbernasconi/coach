import Foundation
import Synchronization

/// What happens when a rest is over: a notification that also reaches a locked phone, a haptic in the app, or nothing.
nonisolated enum RestAlert: String, Codable, CaseIterable, Sendable {
    case alert
    case haptic
    case off
}

/// The person's defaults for every workout (Workout settings, "Rest" and "Screen"). They stay on this iPhone and do not
/// sync: they describe how the phone behaves at the gym, not the log.
nonisolated struct WorkoutPreferences: Codable, Equatable, Sendable {
    /// A rest starts after each logged set. Off for circuits, where a timer is noise.
    var startsRest = true
    /// The rest for an exercise without one of its own, in seconds.
    var defaultRestSeconds = 90
    var restAlert = RestAlert.alert
    /// The screen stays on while a workout runs on the Workout screen.
    var keepsScreenAwake = true
    /// The workout shows on the Lock Screen and in the Dynamic Island.
    var showsLiveActivity = true

    /// The default rest's range and step in the settings stepper.
    static let restRange = 0...600
    static let restStep = 15

    init() {}

    private enum Keys: String, CodingKey {
        case startsRest, defaultRestSeconds, restAlert, keepsScreenAwake, showsLiveActivity
    }

    /// Reads what was saved, with the default for anything missing (a key added in a later build).
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        let defaults = WorkoutPreferences()
        startsRest = try container.decodeIfPresent(Bool.self, forKey: .startsRest) ?? defaults.startsRest
        defaultRestSeconds =
            try container.decodeIfPresent(Int.self, forKey: .defaultRestSeconds) ?? defaults.defaultRestSeconds
        restAlert = (try? container.decodeIfPresent(RestAlert.self, forKey: .restAlert)) ?? defaults.restAlert
        keepsScreenAwake =
            try container.decodeIfPresent(Bool.self, forKey: .keepsScreenAwake) ?? defaults.keepsScreenAwake
        showsLiveActivity =
            try container.decodeIfPresent(Bool.self, forKey: .showsLiveActivity) ?? defaults.showsLiveActivity
    }
}

/// Where the workout defaults live. Sendable, because the Live Activity's buttons read it outside the screen.
nonisolated protocol WorkoutPreferenceStore: AnyObject, Sendable {
    var preferences: WorkoutPreferences { get set }
}

/// `WorkoutPreferenceStore` in UserDefaults, as JSON; the defaults until the person changes them. It keeps the suite's
/// name rather than a `UserDefaults`, so it stays Sendable; UserDefaults is safe from any thread.
nonisolated final class UserDefaultsWorkoutSettings: WorkoutPreferenceStore {
    private static let key = "workout.preferences"
    /// The defaults suite; nil for the app's standard defaults.
    private let suiteName: String?

    init(suiteName: String?) {
        self.suiteName = suiteName
    }

    /// The app's standard defaults.
    static func standard() -> UserDefaultsWorkoutSettings {
        UserDefaultsWorkoutSettings(suiteName: nil)
    }

    /// The only place these preferences touch `UserDefaults.standard` (DI-3).
    private var defaults: UserDefaults {
        suiteName.flatMap(UserDefaults.init(suiteName:)) ?? UserDefaults.standard
    }

    var preferences: WorkoutPreferences {
        get {
            defaults.data(forKey: Self.key).flatMap { try? JSONDecoder().decode(WorkoutPreferences.self, from: $0) }
                ?? WorkoutPreferences()
        }
        set {
            guard let data = try? JSONEncoder().encode(newValue) else { return }
            defaults.set(data, forKey: Self.key)
        }
    }
}

/// `WorkoutPreferenceStore` for demo and `-fresh` data, practice mode and tests: held in memory, never saved.
nonisolated final class InMemoryWorkoutSettings: WorkoutPreferenceStore {
    private let value: Mutex<WorkoutPreferences>

    init(_ preferences: WorkoutPreferences = WorkoutPreferences()) {
        value = Mutex(preferences)
    }

    var preferences: WorkoutPreferences {
        get { value.withLock { $0 } }
        set { value.withLock { $0 = newValue } }
    }
}
