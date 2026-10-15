import Foundation
import GRDB
import Testing

@testable import LiftStore

/// v4 (DATA-5, TEST-5): migrate a v3 database that already holds data and check the template tables.
@Suite struct TemplateMigrationTests {
    private static let stamp = "'2026-03-02 09:00:00.000', '2026-03-02 09:00:00.000'"

    @Test func v4TemplatesAddsBothTablesAndKeepsV3Rows() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v3CatalogID)
        try queue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO session (id, day, title, unitsAtLog, createdAt, updatedAt)
                    VALUES (x'01', '2026-03-02', 'Test', 'kg', \(Self.stamp))
                    """
            )
        }
        #expect(try queue.read { db in try db.tableExists("template") } == false)
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v4Templates)
        try queue.read { db in
            for table in ["template", "templateExercise"] {
                let columns = Set(try db.columns(in: table).map(\.name))
                #expect(columns.isSuperset(of: ["id", "createdAt", "updatedAt", "deletedAt", "position"]), "\(table)")
                #expect(try db.primaryKey(table).columns == ["id"], "\(table)")
            }
            let slotColumns = Set(try db.columns(in: "templateExercise").map(\.name))
            let expected: Set = [
                "templateID", "exerciseID", "displayName", "setCount", "repMin", "repMax", "weightValue", "weightUnit",
                "restSeconds", "kind",
            ]
            #expect(slotColumns.isSuperset(of: expected))
            #expect(try db.indexes(on: "templateExercise").map(\.name).contains("templateExercise_on_template"))
            #expect(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM session") == 1)
        }
    }

    @Test func v4RejectsBadSlotsAndOrphans() throws {
        let queue = try DatabaseQueue(configuration: LiftDatabase.configuration)
        try LiftMigrations.migrator.migrate(queue)
        try queue.write { db in
            try db.execute(
                sql:
                    "INSERT INTO template (id, name, position, createdAt, updatedAt) VALUES (x'01', 'A', 0, \(Self.stamp))"
            )
        }
        let insert = { (parent: String, sets: Int, repMin: Int, repMax: Int, kind: String) in
            """
            INSERT INTO templateExercise
                (id, templateID, position, exerciseID, displayName, setCount, repMin, repMax, kind, createdAt, updatedAt)
            VALUES (x'02', \(parent), 0, x'03', 'Lift', \(sets), \(repMin), \(repMax), '\(kind)', \(Self.stamp))
            """
        }
        for bad in [
            insert("x'01'", 0, 5, 5, "working"),
            insert("x'01'", 3, 8, 6, "working"),
            insert("x'01'", 3, 5, 5, "heavy"),
            insert("x'99'", 3, 5, 5, "working"),
        ] {
            #expect(throws: DatabaseError.self) { try queue.write { db in try db.execute(sql: bad) } }
        }
        try queue.write { db in try db.execute(sql: insert("x'01'", 3, 8, 12, "working")) }
    }
}
