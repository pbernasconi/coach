import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// The lift sheet: move, push a week, remove, each undoable with one soft write (README product rules).
@Suite struct RescheduleTests {
    @Test(arguments: [
        (RescheduleAction.move(to: LocalDay(year: 2026, month: 3, day: 4)), LocalDay(year: 2026, month: 3, day: 4)),
        (RescheduleAction.pushToNextWeek, LocalDay(year: 2026, month: 3, day: 9)),
    ])
    func movingChangesTheDayAndUndoPutsItBack(action: RescheduleAction, expected: LocalDay) async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        var stream = store.sessions.observeSession(id: session.id).makeAsyncIterator()
        #expect(await stream.next()??.session.day == Fixtures.monday)

        let undo = try await store.sessions.reschedule(session.id, action)
        #expect(undo == RescheduleUndo(sessionID: session.id, previousDay: Fixtures.monday))
        #expect(await stream.next()??.session.day == expected)
        #expect(try await store.pendingOutbox().map(\.op) == [.update])

        try await store.sessions.undo(undo)
        #expect(await stream.next()??.session.day == Fixtures.monday)
        #expect(try await store.pendingOutbox().map(\.op) == [.update, .update])
    }

    @Test func removeIsASoftDeleteThatUndoRestores() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        var stream = store.sessions.observeSession(id: session.id).makeAsyncIterator()
        #expect(await stream.next()??.id == session.id)

        let undo = try await store.sessions.reschedule(session.id, .remove)
        #expect(await stream.next() == .some(nil))
        #expect(try await store.pendingOutbox().map(\.op) == [.delete])
        let rawRows = try await store.database.writer.read { db in try SessionRecord.fetchAll(db) }
        #expect(rawRows.count == 1)
        #expect(rawRows.first?.deletedAt == ManualNow.start)

        try await store.sessions.undo(undo)
        #expect(await stream.next()??.session.deletedAt == nil)
    }

    @Test func removedSessionsLeaveTheWeek() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        var stream = store.sessions.observeSessions(from: Fixtures.monday, through: Fixtures.monday.adding(days: 6))
            .makeAsyncIterator()
        #expect(await stream.next()?.count == 1)
        _ = try await store.sessions.reschedule(session.id, .remove)
        #expect(await stream.next() == [])
    }

    @Test func reschedulingARemovedSessionThrowsNotFound() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        _ = try await store.sessions.reschedule(session.id, .remove)
        await #expect(throws: AppError(.notFound, detail: "session \(session.id)")) {
            try await store.sessions.reschedule(session.id, .pushToNextWeek)
        }
    }
}
