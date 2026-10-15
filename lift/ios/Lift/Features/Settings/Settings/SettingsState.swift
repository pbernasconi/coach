import LiftCore

/// Everything the Settings screen renders. Nothing here is saved yet.
nonisolated struct SettingsState: Equatable, Sendable {
    var unit: WeightUnit
    /// "0.1.0 (1)".
    var version: String
    var dataSource: AppInfo.DataSource

    init(unit: WeightUnit, version: String, dataSource: AppInfo.DataSource) {
        self.unit = unit
        self.version = version
        self.dataSource = dataSource
    }

    init(info: AppInfo) {
        self.init(unit: info.unit, version: "\(info.version) (\(info.build))", dataSource: info.dataSource)
    }
}
