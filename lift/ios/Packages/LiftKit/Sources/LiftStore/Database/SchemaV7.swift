import GRDB

/// v7: `workoutSet.rpe`, the set's effort on the `RPE` scale (6 to 10 in half steps, nullable real). It syncs like any
/// column; payloads from builds before v7 omit the key, which reads as `null`. Existing rows keep NULL.
enum SchemaV7 {
    static func create(_ db: Database) throws {
        try db.alter(table: "workoutSet") { table in
            table.add(column: "rpe", .double)
        }
    }
}
