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
    /// Saving finished workouts to Apple Health.
    var health: HealthStatus

    /// The Practice mode switch, from where the data lives.
    var practice: PracticeSection {
        switch dataSource {
        case .device: .off
        case .practice: .on
        case .demo, .fresh: .unavailable
        }
    }

    init(
        unit: WeightUnit,
        version: String,
        dataSource: AppInfo.DataSource,
        sync: SyncSection,
        tokenEditor: TokenEditor? = nil,
        health: HealthStatus = .notSaved
    ) {
        self.unit = unit
        self.version = version
        self.dataSource = dataSource
        self.sync = sync
        self.tokenEditor = tokenEditor
        self.health = health
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

/// The Practice mode section: a switch for the log and for practice data, and nothing for demo and `-fresh` launches.
nonisolated enum PracticeSection: Equatable, Sendable {
    case off
    case on
    case unavailable

    var isOn: Bool { self == .on }
}
