import Foundation
import GRDB
import LiftCore
import LiftTesting
import Testing

@testable import LiftStore

/// v7 (DATA-5, TEST-5): `workoutSet.rpe`, the record round trip with and without it, and the editor's note and RPE
/// writes. Made-up values only (TEST-8).
@Suite struct SetRPEMigrationTests {
    @Test func v7AddsANullableRPEAndKeepsV6Rows() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v6TemplateNote)
        try queue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO session (id, day, title, unitsAtLog, createdAt, updatedAt)
                    VALUES (x'0123456789ABCDEF0123456789ABCDEF', '2026-03-02', 'Test', 'kg', '2026-03-02 09:00:00.000',
                            '2026-03-02 09:00:00.000');
                    INSERT INTO sessionExercise (id, sessionID, position, displayName, loadMode, createdAt, updatedAt)
                    VALUES (x'1123456789ABCDEF0123456789ABCDEF', x'0123456789ABCDEF0123456789ABCDEF', 0, 'Squat',
                            'total', '2026-03-02 09:00:00.000', '2026-03-02 09:00:00.000');
                    INSERT INTO workoutSet (id, sessionExerciseID, position, kind, unit, loadMode, status, actualReps,
                                            note, createdAt, updatedAt)
                    VALUES (x'2123456789ABCDEF0123456789ABCDEF', x'1123456789ABCDEF0123456789ABCDEF', 0, 'working',
                            'kg', 'total', 'done', 5, 'paused', '2026-03-02 09:00:00.000', '2026-03-02 09:00:00.000')
                    """
            )
        }
        #expect(try queue.read { db in try db.columns(in: "workoutSet").map(\.name) }.contains("rpe") == false)
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v7SetRPE)
        try queue.read { db in
            let column = try #require(try db.columns(in: "workoutSet").first { $0.name == "rpe" })
            #expect(column.type.uppercased() == "DOUBLE")
            #expect(column.isNotNull == false)
            let record = try SetRecord(row: try #require(try Row.fetchOne(db, sql: "SELECT * FROM workoutSet")))
            #expect(record.rpe == nil)
            #expect(record.note == "paused")
            #expect(record.actualReps == 5)
        }
    }

    @Test(arguments: [nil, 6.0, 8.5, 10.0] as [Double?])
    func theRecordRoundTripsWithAndWithoutRPE(rpe: Double?) async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        let saved = try await store.sets.saveDetails(setID: set.id, rpe: rpe, note: nil)
        let read = try await store.database.writer.read { db in try SetRecord.fetchOne(db, key: set.id) }
        #expect(read?.loggedSet == saved.loggedSet)
        #expect(read?.rpe == rpe)
        #expect(read?.loggedSet.rpe == rpe)
    }

    @Test func saveDetailsWritesOnceAndNeverLogs() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        let saved = try await store.sets.saveDetails(setID: set.id, rpe: 8, note: "  Made-up note \n")
        #expect(saved.rpe == 8)
        #expect(saved.note == "Made-up note")
        #expect(saved.status == .planned)
        #expect(saved.completedAt == nil)
        #expect(saved.actualReps == nil)
        let entries = try await store.pendingOutbox()
        #expect(entries.map(\.entity) == [.set])
        #expect(entries.first?.payload.contains(#""rpe":8"#) == true)
        let cleared = try await store.sets.saveDetails(setID: set.id, rpe: nil, note: "   ")
        #expect(cleared.rpe == nil)
        #expect(cleared.note == nil)
    }

    @Test func saveDetailsRefusesAnRPEOffTheScale() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        await #expect(throws: AppError(.invalidInput, detail: "rpe 10.5")) {
            try await store.sets.saveDetails(setID: set.id, rpe: 10.5, note: nil)
        }
        #expect(try await store.pendingOutbox().isEmpty)
    }

    @Test func anImportedSetKeepsAnRPEOnTheScaleOnly() async throws {
        let store = try TestStore.make()
        let (_, slot) = try await store.sessionWithSquat()
        let good = LoggedSet(id: UUID(), actual: SetActual(reps: 5, weight: .kg(100)), rpe: 9.5)
        let bad = LoggedSet(id: UUID(), actual: SetActual(reps: 5, weight: .kg(100)), rpe: 11)
        #expect(try await store.sets.addImported(good, to: slot.id, completedAt: nil).rpe == 9.5)
        #expect(try await store.sets.addImported(bad, to: slot.id, completedAt: nil).rpe == nil)
    }

    @Test func sessionAndExerciseNotesAreSavedTrimmedWithOneEntryEach() async throws {
        let store = try TestStore.make()
        let (session, slot) = try await store.sessionWithSquat()
        let savedSession = try await store.sessions.saveNote(sessionID: session.id, note: " Short on time ")
        let savedSlot = try await store.sessions.saveExerciseNote(id: slot.id, note: "Elbows in")
        #expect(savedSession.note == "Short on time")
        #expect(savedSlot.note == "Elbows in")
        #expect(try await store.pendingOutbox().map(\.entity) == [.session, .sessionExercise])
        #expect(try await store.sessions.saveNote(sessionID: session.id, note: "").note == nil)
    }
}
