import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// The Workout screen's Start: one transaction with one outbox entry, and none when the session is already started or
/// finished (TEST-5).
@Suite struct WorkoutStartTests {
    @Test func startStampsTheStartOnceWithOneOutboxEntry() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        store.now.advance(seconds: 60)

        let started = try await store.sessions.start(sessionID: session.id)
        #expect(started.startedAt == ManualNow.start.addingTimeInterval(60))
        let entries = try await store.pendingOutbox()
        #expect(entries.map(\.entity) == [.session])
        #expect(entries.map(\.op) == [.update])

        store.now.advance(seconds: 60)
        let again = try await store.sessions.start(sessionID: session.id)
        #expect(again.startedAt == ManualNow.start.addingTimeInterval(60))
        #expect(try await store.pendingOutbox().count == 1)
    }

    @Test func startLeavesAFinishedSessionAlone() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        _ = try await store.sessions.finish(sessionID: session.id)
        try await store.drainOutbox()

        let after = try await store.sessions.start(sessionID: session.id)
        #expect(after.startedAt == nil)
        #expect(try await store.pendingOutbox().isEmpty)
    }

    @Test func startingARemovedSessionThrows() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        _ = try await store.sessions.reschedule(session.id, .remove)
        await #expect(throws: AppError.self) {
            try await store.sessions.start(sessionID: session.id)
        }
    }
}
