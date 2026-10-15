import Foundation
import GRDB

/// The opened, migrated local database (DATA-1). Build one in the composition root and hand it to the
/// live repositories; tests use `inMemory()`.
public struct LiftDatabase: Sendable {
    /// The GRDB writer. Only Store and Sync code should touch it directly.
    public let writer: any DatabaseWriter

    /// Migrates `writer` to the latest schema and wraps it.
    public init(migrating writer: any DatabaseWriter) throws {
        try LiftMigrations.migrator.migrate(writer)
        self.writer = writer
    }

    /// A private in-memory database at the latest schema. For tests, previews and demo mode.
    public static func inMemory() throws -> LiftDatabase {
        try LiftDatabase(migrating: DatabaseQueue(configuration: configuration))
    }

    /// The on-disk database at `url`, created if missing. WAL mode, so reads never block a write.
    public static func onDisk(at url: URL) throws -> LiftDatabase {
        try LiftDatabase(migrating: DatabasePool(path: url.path, configuration: configuration))
    }

    static var configuration: Configuration {
        var configuration = Configuration()
        configuration.foreignKeysEnabled = true
        return configuration
    }
}
