import GRDB

/// v8: `session.dayMovedAt`, when Lift last changed the session's `day` on this device (a move, "push to next week", or
/// the undo of one), nullable. The server moves the linked plan workout only when this stamp is newer than the
/// workout's own last change (SYNC.md). Payloads from builds before v8 omit the key, which reads as `null`. Existing
/// rows keep NULL.
enum SchemaV8 {
    static func create(_ db: Database) throws {
        try db.alter(table: "session") { table in
            table.add(column: "dayMovedAt", .datetime)
        }
    }
}
