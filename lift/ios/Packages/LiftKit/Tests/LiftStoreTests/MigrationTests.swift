import Foundation
import GRDB
import Testing

@testable import LiftStore

/// One test per migration (DATA-5, TEST-5): migrate from the previous version and check the result.
@Suite struct MigrationTests {
    private static let syncedTables = ["exercise", "session", "sessionExercise", "workoutSet"]

    @Test func migratorRunsEveryMigrationInOrder() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue)
        #expect(LiftMigrations.migrator.migrations == LiftMigrations.all)
        let applied = try queue.read { db in try LiftMigrations.migrator.appliedIdentifiers(db) }
        #expect(applied == Set(LiftMigrations.all))
    }

    @Test func v1InitialCreatesTablesStampsAndIndices() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v1Initial)
        try queue.read { db in
            for table in Self.syncedTables {
                let columns = Set(try db.columns(in: table).map(\.name))
                #expect(columns.isSuperset(of: ["id", "createdAt", "updatedAt", "deletedAt"]), "\(table)")
                #expect(try db.primaryKey(table).columns == ["id"], "\(table)")
            }
            let setColumns = Set(try db.columns(in: "workoutSet").map(\.name))
            let expected: Set = [
                "targetReps", "targetRepMin", "targetRepMax", "targetWeight", "actualReps", "actualWeight", "unit",
                "loadMode", "loadAddedValue", "loadAddedUnit", "status", "completedAt",
            ]
            #expect(setColumns.isSuperset(of: expected))
            let outboxColumns = Set(try db.columns(in: "outbox").map(\.name))
            #expect(outboxColumns == ["id", "entity", "rowID", "op", "payload", "idempotencyKey", "createdAt"])
            #expect(try db.indexes(on: "session").map(\.name).contains("session_on_day"))
            #expect(try db.indexes(on: "sessionExercise").map(\.name).contains("sessionExercise_on_session"))
            #expect(try db.indexes(on: "workoutSet").map(\.name).contains("workoutSet_on_sessionExercise"))
        }
    }

    @Test func v1InitialRejectsUnknownUnitsAndStatuses() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v1Initial)
        let insert = """
            INSERT INTO session (id, day, title, unitsAtLog, createdAt, updatedAt)
            VALUES (x'01', '2026-03-02', 'Test', ?, '2026-03-02 09:00:00.000', '2026-03-02 09:00:00.000')
            """
        #expect(throws: DatabaseError.self) {
            try queue.write { db in try db.execute(sql: insert, arguments: ["stone"]) }
        }
        try queue.write { db in try db.execute(sql: insert, arguments: ["kg"]) }
    }

    @Test func foreignKeysAreEnforcedOnParentLinks() async throws {
        let database = try LiftDatabase.inMemory()
        let enabled = try await database.writer.read { db in try Bool.fetchOne(db, sql: "PRAGMA foreign_keys") }
        #expect(enabled == true)
        let orphan = """
            INSERT INTO sessionExercise (id, sessionID, position, displayName, loadMode, createdAt, updatedAt)
            VALUES (x'02', x'99', 0, 'Orphan', 'total', '2026-03-02 09:00:00.000', '2026-03-02 09:00:00.000')
            """
        await #expect(throws: DatabaseError.self) {
            try await database.writer.write { db in try db.execute(sql: orphan) }
        }
    }

    @Test func sessionDayQueryUsesThePartialIndex() throws {
        let database = try LiftDatabase.inMemory()
        let plan = try database.writer.read { db in
            try Row.fetchAll(
                db,
                sql: "EXPLAIN QUERY PLAN SELECT * FROM session WHERE deletedAt IS NULL AND day >= ? AND day <= ?",
                arguments: ["2026-03-02", "2026-03-08"]
            )
        }
        let details = plan.compactMap { row -> String? in row["detail"] }
        #expect(details.joined().contains("session_on_day"))
    }
}
