import Foundation
import GRDB
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import LiftStore

/// Pause (v9): `pausedAt` travels as ISO 8601 with `Z` and `pausedSeconds` as a number, and both are applied from
/// pulls; a payload from a build before v9 has neither key and reads as never paused (SYNC.md).
@Suite struct SessionPauseSyncTests {
    private func pausedSession(_ store: TestStore) async throws -> SessionRecord {
        let session = try await store.sessions.createSession(
            on: Fixtures.monday,
            title: "Lower A",
            unit: .kg,
            templateID: nil
        )
        _ = try await store.sessions.start(sessionID: session.id)
        store.now.advance(seconds: 0.25)
        _ = try await store.sessions.changeTime(sessionID: session.id, .pause)
        store.now.advance(seconds: 75)
        _ = try await store.sessions.changeTime(sessionID: session.id, .resume)
        store.now.advance(seconds: 5)
        _ = try await store.sessions.changeTime(sessionID: session.id, .pause)
        let read = try await store.database.writer.read { db in try SessionRecord.fetchOne(db, key: session.id) }
        return try #require(read)
    }

    @Test func pushCarriesThePause() async throws {
        let store = try TestStore.make()
        _ = try await pausedSession(store)
        let changes = try await store.outbox.pending(limit: 10).map(PushChange.init(entry:))
        let last = try #require(changes.last)
        #expect(last.payload["pausedAt"] == .string("2026-03-02T09:01:20.250Z"))
        #expect(last.payload["pausedSeconds"] == .integer(75))
        #expect(changes.first?.payload["pausedSeconds"] == .integer(0))
    }

    @Test func pullAppliesThePause() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let session = try await pausedSession(remote.store)
        harness.transport.queuePull(PullResponse(changes: try await remote.takeChanges(), cursor: "2", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.database.writer.read { db in
            try SessionRecord.fetchOne(db, key: session.id)
        }
        #expect(local?.pausedAt == session.pausedAt)
        #expect(local?.pausedSeconds == 75)
    }

    @Test func aPayloadFromBeforeV9ReadsAsNeverPaused() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let session = try await pausedSession(remote.store)
        let changes = try await remote.takeChanges().map { change in
            var old = change
            old.payload["pausedAt"] = nil  // as written by a build before v9
            old.payload["pausedSeconds"] = nil
            return old
        }
        harness.transport.queuePull(PullResponse(changes: changes, cursor: "2", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.database.writer.read { db in
            try SessionRecord.fetchOne(db, key: session.id)
        }
        #expect(local != nil)
        #expect(local?.pausedAt == nil)
        #expect(local?.pausedSeconds == 0)
    }
}
