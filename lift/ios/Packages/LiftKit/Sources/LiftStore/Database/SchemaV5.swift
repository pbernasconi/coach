import GRDB

/// v5: `session.healthWorkoutID`, the Apple Health workout Lift saved for a finished session (a UUID blob, nullable).
/// It syncs like any column, so a second device sees the workout is already in Health (Health shares it across the
/// person's devices) and never saves it again. Existing rows keep NULL: nothing was saved to Health before v5.
enum SchemaV5 {
    static func create(_ db: Database) throws {
        try db.alter(table: "session") { table in
            table.add(column: "healthWorkoutID", .blob)
        }
    }
}
