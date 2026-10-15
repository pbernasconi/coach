import GRDB

/// v1: exercises, sessions, session exercises, sets and the outbox. Every synced table has a client-made
/// UUID `id` and the row stamps (DATA-2); sets carry target and actual, unit and load mode (DATA-6, DATA-7).
enum SchemaV1 {
    static func create(_ db: Database) throws {
        try createExercise(db)
        try createSession(db)
        try createSessionExercise(db)
        try createWorkoutSet(db)
        try createOutbox(db)
        try createIndices(db)
    }

    private static func createExercise(_ db: Database) throws {
        try db.create(table: "exercise") { table in
            table.primaryKey("id", .blob)
            table.column("name", .text).notNull()
            table.column("aliases", .jsonText).notNull()
            table.column("equipment", .text).notNull()
            loadModeColumns(table)
            table.column("primaryMuscles", .jsonText).notNull()
            table.column("secondaryMuscles", .jsonText).notNull()
            table.column("videoURL", .text)
            table.column("isArchived", .boolean).notNull().defaults(to: false)
            stamps(table)
        }
    }

    private static func createSession(_ db: Database) throws {
        try db.create(table: "session") { table in
            table.primaryKey("id", .blob)
            table.column("day", .text).notNull()  // "YYYY-MM-DD", a LocalDay: no time, no zone
            table.column("title", .text).notNull()
            table.column("templateID", .blob)
            table.column("startedAt", .datetime)
            table.column("finishedAt", .datetime)
            table.column("warmUpNote", .text)
            table.column("note", .text)
            table.column("unitsAtLog", .text).notNull().check(sql: "unitsAtLog IN ('lb', 'kg')")
            stamps(table)
        }
    }

    private static func createSessionExercise(_ db: Database) throws {
        try db.create(table: "sessionExercise") { table in
            table.primaryKey("id", .blob)
            table.column("sessionID", .blob).notNull().references("session", deferred: true)
            // A soft link, no foreign key: the name and load mode are stamped on the row, and a library row
            // may arrive later than the sessions that use it.
            table.column("exerciseID", .blob)
            table.column("position", .integer).notNull()
            table.column("displayName", .text).notNull()
            loadModeColumns(table)
            table.column("equipment", .text)
            table.column("restSeconds", .integer)
            table.column("note", .text)
            table.column("supersetGroup", .integer)
            table.column("nextTimeHintValue", .double)
            table.column("nextTimeHintUnit", .text)
            stamps(table)
        }
    }

    private static func createWorkoutSet(_ db: Database) throws {
        try db.create(table: "workoutSet") { table in
            table.primaryKey("id", .blob)
            table.column("sessionExerciseID", .blob).notNull().references("sessionExercise", deferred: true)
            table.column("position", .integer).notNull()
            table.column("kind", .text).notNull()
            table.column("targetReps", .integer)
            table.column("targetRepMin", .integer)
            table.column("targetRepMax", .integer)
            table.column("targetWeight", .double)  // in `unit`
            table.column("actualReps", .integer)
            table.column("actualWeight", .double)  // in `unit`
            table.column("unit", .text).notNull().check(sql: "unit IN ('lb', 'kg')")
            loadModeColumns(table)
            table.column("status", .text).notNull().defaults(to: "planned")
                .check(sql: "status IN ('planned', 'done', 'skipped')")
            table.column("completedAt", .datetime)
            table.column("note", .text)
            stamps(table)
        }
    }

    private static func createOutbox(_ db: Database) throws {
        try db.create(table: "outbox") { table in
            table.primaryKey("id", .blob)
            table.column("entity", .text).notNull()
            table.column("rowID", .blob).notNull()
            table.column("op", .text).notNull().check(sql: "op IN ('insert', 'update', 'delete')")
            table.column("payload", .jsonText).notNull()
            table.column("idempotencyKey", .blob).notNull().unique()
            table.column("createdAt", .datetime).notNull()
        }
    }

    private static func createIndices(_ db: Database) throws {
        try db.create(
            index: "session_on_day",
            on: "session",
            columns: ["day"],
            condition: Column("deletedAt") == nil
        )
        try db.create(index: "sessionExercise_on_session", on: "sessionExercise", columns: ["sessionID", "position"])
        try db.create(
            index: "workoutSet_on_sessionExercise",
            on: "workoutSet",
            columns: ["sessionExerciseID", "position"]
        )
    }

    /// `loadMode` is total | perHand | perSide | bodyweight; bodyweight may add `loadAddedValue` in `loadAddedUnit`.
    private static func loadModeColumns(_ table: TableDefinition) {
        table.column("loadMode", .text).notNull()
            .check(sql: "loadMode IN ('total', 'perHand', 'perSide', 'bodyweight')")
        table.column("loadAddedValue", .double)
        table.column("loadAddedUnit", .text)
    }

    /// The row stamps every synced table carries (DATA-2). `deletedAt` is the tombstone.
    private static func stamps(_ table: TableDefinition) {
        table.column("createdAt", .datetime).notNull()
        table.column("updatedAt", .datetime).notNull()
        table.column("deletedAt", .datetime)
    }
}
