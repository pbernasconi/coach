import Foundation

/// The install's own id for push registration (lift/PUSH.md): made once and kept, so a new APNs token from this install
/// replaces its old one on the server. Not the sync device id; nothing else reads it.
final class PushInstallSettings {
    private static let key = "push.installID"
    private let defaults: UserDefaults

    init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    /// The app's standard defaults: the only place this id touches `UserDefaults.standard` (DI-3).
    static func standard() -> PushInstallSettings {
        PushInstallSettings(defaults: UserDefaults.standard)
    }

    /// The kept id, or a new one from `makeID`, kept from now on.
    func installID(makeID: () -> UUID) -> String {
        if let id = defaults.string(forKey: Self.key), !id.isEmpty { return id }
        let id = makeID().uuidString
        defaults.set(id, forKey: Self.key)
        return id
    }
}
