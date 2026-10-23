import GRDB

/// v9: Pause. `session.pausedAt`, when the running pause started (nullable), and `session.pausedSeconds`, the whole
/// seconds of every pause already ended (not null, 0). The workout's length leaves both out (SYNC.md). Payloads from
/// builds before v9 omit the keys, which read as `null` and 0. Existing rows get NULL and 0.
enum SchemaV9 {
    static func create(_ db: Database) throws {
        try db.alter(table: "session") { table in
            table.add(column: "pausedAt", .datetime)
            table.add(column: "pausedSeconds", .integer).notNull().defaults(to: 0)
        }
    }
}
