import GRDB

/// v4: workout templates. `template` is a named day ("Upper A"); `templateExercise` holds its ordered exercise slots,
/// each a library exercise with a set count, a rep target or range, an optional load, rest and set kind. Both tables
/// sync, so they carry a client-made UUID and the row stamps (DATA-2). A session already records the template it came
/// from (`session.templateID`, v1) and when it started and finished, so sessions need no new columns.
enum SchemaV4 {
    static func create(_ db: Database) throws {
        try db.create(table: "template") { table in
            table.primaryKey("id", .blob)
            table.column("name", .text).notNull()
            table.column("position", .integer).notNull()
            stamps(table)
        }
        try db.create(table: "templateExercise") { table in
            table.primaryKey("id", .blob)
            table.column("templateID", .blob).notNull().references("template", deferred: true)
            table.column("position", .integer).notNull()
            // A soft link, like sessionExercise.exerciseID: a library row may arrive later than the template.
            table.column("exerciseID", .blob).notNull()
            table.column("displayName", .text).notNull()
            table.column("setCount", .integer).notNull().check(sql: "setCount >= 1")
            table.column("repMin", .integer).notNull().check(sql: "repMin >= 1")
            table.column("repMax", .integer).notNull().check(sql: "repMax >= repMin")
            table.column("weightValue", .double)
            table.column("weightUnit", .text).check(sql: "weightUnit IS NULL OR weightUnit IN ('lb', 'kg')")
            table.column("restSeconds", .integer)
            table.column("kind", .text).notNull()
                .check(sql: "kind IN ('warmUp', 'working', 'drop', 'failure')")
            stamps(table)
        }
        try db.create(
            index: "templateExercise_on_template",
            on: "templateExercise",
            columns: ["templateID", "position"]
        )
    }

    /// The row stamps every synced table carries (DATA-2), as in v1.
    private static func stamps(_ table: TableDefinition) {
        table.column("createdAt", .datetime).notNull()
        table.column("updatedAt", .datetime).notNull()
        table.column("deletedAt", .datetime)
    }
}
