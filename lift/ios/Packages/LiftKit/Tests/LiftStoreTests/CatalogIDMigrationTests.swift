import Foundation
import GRDB
import LiftCore
import Testing

@testable import LiftStore

/// v3 (DATA-5, TEST-5): migrate a v2 database that already holds exercises and check `catalogID`.
@Suite struct CatalogIDMigrationTests {
    private static let insertExercise = """
        INSERT INTO exercise (id, name, aliases, equipment, loadMode, primaryMuscles, secondaryMuscles, createdAt, updatedAt)
        VALUES (?, ?, '[]', 'barbell', 'total', '[]', '[]', '2026-01-01 00:00:00.000', '2026-01-01 00:00:00.000')
        """

    @Test func v3AddsCatalogIDAndBackfillsSeedRowsOnly() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v2SyncState)
        let custom = UUID(uuid: (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16))
        try queue.write { db in
            try db.execute(sql: Self.insertExercise, arguments: [ExerciseLibrary.seedID(1), "Back squat"])
            try db.execute(sql: Self.insertExercise, arguments: [ExerciseLibrary.seedID(29), "Plank"])
            try db.execute(sql: Self.insertExercise, arguments: [custom, "Sled push"])
        }
        #expect(try queue.read { db in try db.columns(in: "exercise").map(\.name) }.contains("catalogID") == false)
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v3CatalogID)
        let rows = try queue.read { db in
            try Row.fetchAll(db, sql: "SELECT id, catalogID, updatedAt FROM exercise")
        }
        let byID = Dictionary(
            uniqueKeysWithValues: rows.map { row -> (UUID, String?) in (row["id"], row["catalogID"]) }
        )
        #expect(byID[ExerciseLibrary.seedID(1)] == "0043")
        #expect(byID[ExerciseLibrary.seedID(29)] == "2135")
        #expect(byID[custom] == .some(nil))
        #expect(rows.allSatisfy { ($0["updatedAt"] as String?) == "2026-01-01 00:00:00.000" })
        #expect(try queue.read { db in try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM outbox") } == 0)
        #expect(try queue.read { db in try db.indexes(on: "exercise").map(\.name) }.contains("exercise_on_catalogID"))
    }

    @Test func catalogIDIsOptionalText() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue)
        let column = try queue.read { db in try db.columns(in: "exercise").first { $0.name == "catalogID" } }
        #expect(column?.type == "TEXT")
        #expect(column?.isNotNull == false)
    }
}
