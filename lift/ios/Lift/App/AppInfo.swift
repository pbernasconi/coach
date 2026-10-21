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
        /// Practice mode (Settings): sample workouts in their own database on this iPhone, apart from the log.
        case practice

        /// Whether this is the person's own log on this iPhone. Any other data is never synced or saved to Apple
        /// Health, and never changes the saved unit or gym.
        var isSaved: Bool { self == .device }

        /// Made-up sessions and the made-up coach plan: demo data and practice mode.
        var isSample: Bool { self == .demo || self == .practice }
    }

    var version: String
    var build: String
    /// The preferred weight unit when it was read (`AppDependencies.info` reads it fresh each time).
    var unit: WeightUnit
    var dataSource: DataSource
}
