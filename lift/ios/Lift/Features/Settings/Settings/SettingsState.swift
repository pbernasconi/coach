import LiftCore

/// Everything the Settings screen renders. Nothing here is saved yet except the sync token, which lives in the
/// Keychain and never in this state once saved.
nonisolated struct SettingsState: Equatable, Sendable {
    var unit: WeightUnit
    /// "0.1.0 (1)".
    var version: String
    var dataSource: AppInfo.DataSource
    var sync: SyncSection
    /// The sync token sheet, while it is open.
    var tokenEditor: TokenEditor?

    init(
        unit: WeightUnit,
        version: String,
        dataSource: AppInfo.DataSource,
        sync: SyncSection,
        tokenEditor: TokenEditor? = nil
    ) {
        self.unit = unit
        self.version = version
        self.dataSource = dataSource
        self.sync = sync
        self.tokenEditor = tokenEditor
    }

    init(info: AppInfo, sync: SyncSection) {
        self.init(
            unit: info.unit,
            version: "\(info.version) (\(info.build))",
            dataSource: info.dataSource,
            sync: sync
        )
    }
}
