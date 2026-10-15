import GRDB
import LiftCore

/// v3: `exercise.catalogID`, the bundled catalog entry an exercise came from or shows media for (nullable text).
/// The fixed seed rows already on the device get their entry here, without touching `updatedAt` or the outbox: every
/// device runs the same backfill, and a seed row decodes to its entry even from a payload that predates the column.
enum SchemaV3 {
    static func create(_ db: Database) throws {
        try db.alter(table: "exercise") { table in
            table.add(column: "catalogID", .text)
        }
        try db.create(
            index: "exercise_on_catalogID",
            on: "exercise",
            columns: ["catalogID"],
            condition: Column("catalogID") != nil
        )
        for link in CatalogSeedLinks.all {
            try db.execute(
                sql: "UPDATE exercise SET catalogID = ? WHERE id = ? AND catalogID IS NULL",
                arguments: [link.catalogID, ExerciseLibrary.seedID(link.seed)]
            )
        }
    }
}
