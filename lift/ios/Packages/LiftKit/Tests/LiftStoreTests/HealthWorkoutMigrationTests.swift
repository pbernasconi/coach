import Foundation
import GRDB
import Testing

@testable import LiftStore

/// v5 (DATA-5, TEST-5): migrate a v4 database that already holds a finished session and check the new column.
@Suite struct HealthWorkoutMigrationTests {
    @Test func v5AddsANullableHealthWorkoutIDAndKeepsV4Rows() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v4Templates)
        try queue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO session (id, day, title, unitsAtLog, startedAt, finishedAt, createdAt, updatedAt)
                    VALUES (x'0123456789ABCDEF0123456789ABCDEF', '2026-03-02', 'Test', 'kg', '2026-03-02 09:00:00.000', '2026-03-02 09:50:00.000',
                            '2026-03-02 09:00:00.000', '2026-03-02 09:50:00.000')
                    """
            )
        }
        #expect(try queue.read { db in try db.columns(in: "session").map(\.name) }.contains("healthWorkoutID") == false)
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v5HealthWorkout)
        try queue.read { db in
            let column = try #require(try db.columns(in: "session").first { $0.name == "healthWorkoutID" })
            #expect(column.type.uppercased() == "BLOB")
            #expect(column.isNotNull == false)
            let row = try #require(try Row.fetchOne(db, sql: "SELECT * FROM session"))
            let record = try SessionRecord(row: row)
            #expect(record.healthWorkoutID == nil)
            #expect(record.finishedAt != nil)
        }
    }
}
