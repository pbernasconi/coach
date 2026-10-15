import Foundation
import GRDB
import Testing

@testable import LiftStore

/// v2 (DATA-5, TEST-5): migrate a v1 database that already holds data and check the new table.
@Suite struct SyncStateMigrationTests {
    @Test func v2SyncStateAddsTheTableAndKeepsV1Rows() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v1Initial)
        try queue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO session (id, day, title, unitsAtLog, createdAt, updatedAt)
                    VALUES (x'01', '2026-03-02', 'Test', 'kg', '2026-03-02 09:00:00.000', '2026-03-02 09:00:00.000')
                    """
            )
        }
        #expect(try queue.read { db in try db.tableExists("syncState") } == false)
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v2SyncState)
        try queue.read { db in
            #expect(try db.columns(in: "syncState").map(\.name) == ["key", "value"])
            #expect(try db.primaryKey("syncState").columns == ["key"])
            #expect(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM session") == 1)
        }
    }

    @Test func syncStateKeysAreUnique() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue)
        try queue.write { db in try db.execute(sql: "INSERT INTO syncState (key, value) VALUES ('pullCursor', '1')") }
        #expect(throws: DatabaseError.self) {
            try queue.write { db in try db.execute(sql: "INSERT INTO syncState (key, value) VALUES ('pullCursor', '2')") }
        }
    }
}
