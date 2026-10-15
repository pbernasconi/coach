import Foundation

/// Lift's App Group, shared by the app and its extensions: the rest Live Activity's +30s and Skip buttons and the Share
/// extension's note inbox. Each target's Info.plist names it under `LiftAppGroup` as `group.$(LIFT_BUNDLE_ID)` (see
/// `project.yml`), so it follows the bundle id the build uses. Compiled into the app, LiftWidgets and LiftShare.
nonisolated enum AppGroup {
    /// The Info.plist key that holds the group's identifier.
    static let infoKey = "LiftAppGroup"

    /// The group's identifier from `bundle`'s Info.plist; nil when it names none.
    static func identifier(in bundle: Bundle) -> String? {
        guard let identifier = bundle.object(forInfoDictionaryKey: infoKey) as? String, !identifier.isEmpty else {
            return nil
        }
        return identifier
    }

    /// The group's shared defaults. Outside a signed build (the simulator in CI) the group is not provisioned and
    /// these are the process's own defaults under the group's name, which still works within one process.
    static func defaults(suiteName: String) -> UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }
}
