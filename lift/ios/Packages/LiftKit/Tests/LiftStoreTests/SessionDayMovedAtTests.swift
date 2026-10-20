import Foundation
import GRDB
import LiftCore
import LiftTesting
import Testing

@testable import LiftStore

/// v8 (DATA-5, TEST-5): `session.dayMovedAt`. A move, a push to next week and the undo of either stamp it; a remove,
/// its undo and every other edit keep it (SYNC.md). Made-up values only (TEST-8).
@Suite struct SessionDayMovedAtTests {
    private func stored(_ store: TestStore, _ id: UUID) async throws -> SessionRecord? {
        try await store.database.writer.read { db in try SessionRecord.fetchOne(db, key: id) }
    }

    @Test func v8AddsANullableDateAndKeepsV7Rows() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v7SetRPE)
        try queue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO session (id, day, title, unitsAtLog, createdAt, updatedAt)
                    VALUES (x'0123456789ABCDEF0123456789ABCDEF', '2026-03-02', 'Test', 'kg', '2026-03-02 09:00:00.000',
                            '2026-03-02 09:00:00.000')
                    """
            )
        }
        #expect(try queue.read { db in try db.columns(in: "session").map(\.name) }.contains("dayMovedAt") == false)
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v8SessionDayMovedAt)
        try queue.read { db in
            let column = try #require(try db.columns(in: "session").first { $0.name == "dayMovedAt" })
            #expect(column.type.uppercased() == "DATETIME")
            #expect(column.isNotNull == false)
            let record = try SessionRecord(row: try #require(try Row.fetchOne(db, sql: "SELECT * FROM session")))
            #expect(record.dayMovedAt == nil)
            #expect(record.title == "Test")
        }
    }

    @Test(arguments: [RescheduleAction.move(to: LocalDay(year: 2026, month: 3, day: 4)), .pushToNextWeek])
    func aMoveAndItsUndoStampTheDay(action: RescheduleAction) async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        #expect(try await stored(store, session.id)?.dayMovedAt == nil)

        store.now.advance(seconds: 60)
        let undo = try await store.sessions.reschedule(session.id, action)
        let moved = ManualNow.start.addingTimeInterval(60)
        #expect(try await stored(store, session.id)?.dayMovedAt == moved)
        #expect(try await store.pendingOutbox().first?.payload.contains("dayMovedAt") == true)

        store.now.advance(seconds: 60)
        try await store.sessions.undo(undo)
        #expect(try await stored(store, session.id)?.dayMovedAt == moved.addingTimeInterval(60))
    }

    @Test func aMoveToTheSameDayKeepsTheStamp() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        _ = try await store.sessions.reschedule(session.id, .move(to: Fixtures.monday))
        #expect(try await stored(store, session.id)?.dayMovedAt == nil)
    }

    @Test func removeItsUndoAndOtherEditsKeepTheStamp() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        _ = try await store.sessions.reschedule(session.id, .pushToNextWeek)
        let moved = try await stored(store, session.id)?.dayMovedAt
        #expect(moved == ManualNow.start)

        store.now.advance(seconds: 60)
        let removal = try await store.sessions.reschedule(session.id, .remove)
        try await store.sessions.undo(removal)
        _ = try await store.sessions.saveNote(sessionID: session.id, note: "Made-up note")
        let after = try await stored(store, session.id)
        #expect(after?.dayMovedAt == moved)
        #expect(after?.note == "Made-up note")
        #expect(after?.day == Fixtures.monday.adding(days: 7))
    }
}
