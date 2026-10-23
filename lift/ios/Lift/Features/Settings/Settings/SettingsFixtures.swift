#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension SettingsState {
        static let fixtureDefault = SettingsState(
            unit: .kg,
            version: "0.1.0 (1)",
            dataSource: .device,
            sync: .available(SyncSummary(status: "Synced 2 min ago", isSyncing: false, hasToken: true)),
            health: .on
        )
        /// With the server's half loaded from the made-up demo body: the coach's side and every connection.
        static var fixtureConnected: SettingsState {
            var state = fixtureDefault
            if let url = Bundle.main.url(forResource: "app-settings", withExtension: "json"),
                let data = try? Data(contentsOf: url),
                let settings = try? JSONDecoder().decode(AppSettings.self, from: data)
            {
                state.remote.content = .loaded(settings)
            }
            return state
        }
        /// Apple Health on in Lift but not allowed in Health.
        static let fixtureHealthDenied = SettingsState(
            unit: .kg,
            version: "0.1.0 (1)",
            dataSource: .device,
            sync: .available(SyncSummary(status: "Synced 2 min ago", isSyncing: false, hasToken: true)),
            health: .denied
        )
        static let fixturePounds = SettingsState(
            unit: .lb,
            version: "0.1.0 (1)",
            dataSource: .device,
            sync: .available(SyncSummary(status: "Synced 3 h ago", isSyncing: false, hasToken: true))
        )
        static let fixtureDemo = SettingsState(unit: .kg, version: "0.1.0 (1)", dataSource: .demo, sync: .demo)
        /// Practice mode on: sample workouts in their own database.
        static let fixturePractice = SettingsState(unit: .lb, version: "0.1.0 (1)", dataSource: .practice, sync: .demo)
        static let fixtureSyncing = SettingsState(
            unit: .kg,
            version: "0.1.0 (1)",
            dataSource: .device,
            sync: .available(SyncSummary(status: "Syncing…", isSyncing: true, hasToken: true))
        )
        static let fixtureNotSetUp = SettingsState(
            unit: .kg,
            version: "0.1.0 (1)",
            dataSource: .device,
            sync: .available(SyncSummary(status: "Not set up", isSyncing: false, hasToken: false))
        )
        static let fixtureTokenRejected = SettingsState(
            unit: .kg,
            version: "0.1.0 (1)",
            dataSource: .device,
            sync: .available(SyncSummary(status: "Token rejected", isSyncing: false, hasToken: true))
        )
        static let fixtureNoServer = SettingsState(
            unit: .kg,
            version: "0.1.0 (1)",
            dataSource: .device,
            sync: .unavailable
        )
        /// The token sheet over a stored token, with a made-up draft.
        static let fixtureTokenEditor = SettingsState(
            unit: .kg,
            version: "0.1.0 (1)",
            dataSource: .device,
            sync: .available(SyncSummary(status: "Token rejected", isSyncing: false, hasToken: true)),
            tokenEditor: TokenEditor(draft: "made-up-token-0000", canRemove: true)
        )
    }
#endif
