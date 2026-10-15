import GRDB

/// Every schema change, in order (DATA-5). Never edit a migration once it has shipped; add a new one with
/// its own test in `MigrationTests`.
enum LiftMigrations {
    static let v1Initial = "v1_initial"
    static let v2SyncState = "v2_syncState"
    static let v3CatalogID = "v3_catalogID"

    /// Identifiers in the order they run.
    static let all = [v1Initial, v2SyncState, v3CatalogID]

    static var migrator: DatabaseMigrator {
        var migrator = DatabaseMigrator()
        migrator.registerMigration(v1Initial, migrate: SchemaV1.create)
        migrator.registerMigration(v2SyncState, migrate: SchemaV2.create)
        migrator.registerMigration(v3CatalogID, migrate: SchemaV3.create)
        return migrator
    }
}
