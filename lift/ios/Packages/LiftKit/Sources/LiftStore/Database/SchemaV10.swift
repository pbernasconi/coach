import GRDB

/// v10: the workout timeline. `workoutEvent` holds one row per moment of a workout, stamped when it happened: start,
/// pause, resume, finish, discard, an exercise's Start, each set logged, undone, skipped or removed, and each rest
/// started, extended, skipped or run out (`WorkoutEventKind`). Rows are only ever inserted, and sync like the others
/// (SYNC.md), so the timeline can be analysed on the server later. `sessionID` and `setID` are soft links, like
/// `sessionExercise.exerciseID`: an event may arrive before its session on another device.
enum SchemaV10 {
    static func create(_ db: Database) throws {
        try db.create(table: "workoutEvent") { table in
            table.primaryKey("id", .blob)
            table.column("sessionID", .blob).notNull()
            table.column("kind", .text).notNull()
            table.column("occurredAt", .datetime).notNull()
            table.column("setID", .blob)
            table.column("seconds", .integer)
            table.column("source", .text).notNull()
            table.column("createdAt", .datetime).notNull()
            table.column("updatedAt", .datetime).notNull()
            table.column("deletedAt", .datetime)
        }
        try db.create(index: "workoutEvent_on_session", on: "workoutEvent", columns: ["sessionID", "occurredAt"])
    }
}
