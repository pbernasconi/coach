import GRDB

/// v6: `templateExercise.note`, a cue for the slot ("Deep squat", nullable text) that a session planned from the
/// template starts with as its exercise note. Template links write it (`lift/TEMPLATE-LINKS.md`). It syncs like any
/// column; payloads from builds before v6 omit the key, which reads as `null`. Existing rows keep NULL.
enum SchemaV6 {
    static func create(_ db: Database) throws {
        try db.alter(table: "templateExercise") { table in
            table.add(column: "note", .text)
        }
    }
}
