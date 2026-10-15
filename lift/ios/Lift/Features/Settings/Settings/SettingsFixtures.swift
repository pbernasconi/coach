#if DEBUG
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension SettingsState {
        static let fixtureDefault = SettingsState(unit: .kg, version: "0.1.0 (1)", dataSource: .device)
        static let fixturePounds = SettingsState(unit: .lb, version: "0.1.0 (1)", dataSource: .device)
        static let fixtureDemo = SettingsState(unit: .kg, version: "0.1.0 (1)", dataSource: .demo)
    }
#endif
