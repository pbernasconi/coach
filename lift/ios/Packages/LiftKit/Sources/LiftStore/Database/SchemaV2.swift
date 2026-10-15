import GRDB

/// v2: the `syncState` key/value table for the sync engine (SYNC.md): the pull cursor, this device's id and
/// the last successful sync. Local only; it never syncs and has no outbox entries.
enum SchemaV2 {
    static func create(_ db: Database) throws {
        try db.create(table: "syncState") { table in
            table.primaryKey("key", .text)
            table.column("value", .text).notNull()
        }
    }
}
