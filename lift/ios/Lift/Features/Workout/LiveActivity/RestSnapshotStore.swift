import Foundation

/// Where the current `RestSnapshot` is kept, so the app and the Live Activity's buttons read and write one rest.
nonisolated protocol RestSnapshotStoring: Sendable {
    /// The saved rest; nil when there is none.
    func load() -> RestSnapshot?
    /// Saves `rest`, or clears it with nil.
    func save(_ rest: RestSnapshot?)
}

/// The rest in the App Group's defaults, as JSON. The defaults are opened on each call, so the value is never cached
/// across the processes that share it. Compiled into the app and LiftWidgets.
nonisolated struct AppGroupRestSnapshotStore: RestSnapshotStoring {
    static let key = "restSnapshot"
    let suiteName: String

    init(suiteName: String) {
        self.suiteName = suiteName
    }

    /// The store of the App Group `bundle` names; nil when its Info.plist names none.
    init?(bundle: Bundle) {
        guard let suiteName = AppGroup.identifier(in: bundle) else { return nil }
        self.init(suiteName: suiteName)
    }

    func load() -> RestSnapshot? {
        guard let data = AppGroup.defaults(suiteName: suiteName)?.data(forKey: Self.key) else { return nil }
        return try? JSONDecoder().decode(RestSnapshot.self, from: data)
    }

    func save(_ rest: RestSnapshot?) {
        let defaults = AppGroup.defaults(suiteName: suiteName)
        guard let rest, let data = try? JSONEncoder().encode(rest) else {
            defaults?.removeObject(forKey: Self.key)
            return
        }
        defaults?.set(data, forKey: Self.key)
    }
}
