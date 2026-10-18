import GRDB

/// Every schema change, in order (DATA-5). Never edit a migration once it has shipped; add a new one with
/// its own test in `MigrationTests`.
enum LiftMigrations {
    static let v1Initial = "v1_initial"
    static let v2SyncState = "v2_syncState"
    static let v3CatalogID = "v3_catalogID"
    static let v4Templates = "v4_templates"
    static let v5HealthWorkout = "v5_healthWorkout"
    static let v6TemplateNote = "v6_templateNote"

    /// Identifiers in the order they run.
    static let all = [v1Initial, v2SyncState, v3CatalogID, v4Templates, v5HealthWorkout, v6TemplateNote]

    static var migrator: DatabaseMigrator {
        var migrator = DatabaseMigrator()
        migrator.registerMigration(v1Initial, migrate: SchemaV1.create)
        migrator.registerMigration(v2SyncState, migrate: SchemaV2.create)
        migrator.registerMigration(v3CatalogID, migrate: SchemaV3.create)
        migrator.registerMigration(v4Templates, migrate: SchemaV4.create)
        migrator.registerMigration(v5HealthWorkout, migrate: SchemaV5.create)
        migrator.registerMigration(v6TemplateNote, migrate: SchemaV6.create)
        return migrator
    }
}
