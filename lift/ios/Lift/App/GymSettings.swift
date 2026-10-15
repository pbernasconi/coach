import Foundation
import LiftCore
import Synchronization

/// The person's bars, plates and collars (Settings → Plates and bars). The Workout screen's plates per side and warm-ups,
/// the set editor's weight step and planned barbell loads read it. It stays on this iPhone and does not sync: it
/// describes the gym, not the log. Sendable, because the plan repository reads it at each write.
nonisolated protocol GymPreference: AnyObject, Sendable {
    var setup: GymSetup { get set }
}

/// `GymPreference` in UserDefaults, as JSON; the made-up defaults (`GymSetup.standard`) until the person changes them.
/// It keeps the suite's name rather than a `UserDefaults`, so it stays Sendable; UserDefaults is safe from any thread.
nonisolated final class UserDefaultsGymSettings: GymPreference {
    private static let key = "gym.setup"
    /// The defaults suite; nil for the app's standard defaults.
    private let suiteName: String?

    init(suiteName: String?) {
        self.suiteName = suiteName
    }

    /// The app's standard defaults.
    static func standard() -> UserDefaultsGymSettings {
        UserDefaultsGymSettings(suiteName: nil)
    }

    /// The only place this preference touches `UserDefaults.standard` (DI-3).
    private var defaults: UserDefaults {
        suiteName.flatMap(UserDefaults.init(suiteName:)) ?? UserDefaults.standard
    }

    var setup: GymSetup {
        get {
            defaults.data(forKey: Self.key).flatMap { try? JSONDecoder().decode(GymSetup.self, from: $0) } ?? .standard
        }
        set {
            guard let data = try? JSONEncoder().encode(newValue) else { return }
            defaults.set(data, forKey: Self.key)
        }
    }
}

/// `GymPreference` for demo and `-fresh` data, and for tests: held in memory, never saved.
nonisolated final class InMemoryGymSettings: GymPreference {
    private let value: Mutex<GymSetup>

    init(_ setup: GymSetup) {
        value = Mutex(setup)
    }

    var setup: GymSetup {
        get { value.withLock { $0 } }
        set { value.withLock { $0 = newValue } }
    }
}
