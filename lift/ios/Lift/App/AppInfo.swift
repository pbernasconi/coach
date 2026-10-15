import Foundation
import LiftCore

/// Facts about this install that screens show but never change. Built once in the composition root.
nonisolated struct AppInfo: Equatable, Sendable {
    /// Where the data on screen lives.
    enum DataSource: Equatable, Sendable {
        /// The database on this iPhone.
        case device
        /// Fabricated demo data in memory; nothing is saved.
        case demo
        /// An empty database in memory, as a first launch leaves it (`-fresh`); nothing is saved.
        case fresh

        /// Whether the data is kept on this iPhone. Data that is not is never synced or saved to Apple Health.
        var isSaved: Bool { self == .device }
    }

    var version: String
    var build: String
    var unit: WeightUnit
    var dataSource: DataSource
}
