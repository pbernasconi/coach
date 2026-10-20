import Foundation
import GRDB
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import LiftStore

/// `session.dayMovedAt` (v8) travels as ISO 8601 with `Z` and is applied from pulls; a payload from a build before v8
/// has no key and reads as never moved (SYNC.md).
@Suite struct SessionDayMovedAtSyncTests {
    private func movedSession(_ store: TestStore) async throws -> SessionRecord {
        let session = try await store.sessions.createSession(
            on: Fixtures.monday,
            title: "Lower A",
            unit: .kg,
            templateID: nil
        )
        store.now.advance(seconds: 0.25)
        _ = try await store.sessions.reschedule(session.id, .pushToNextWeek)
        let read = try await store.database.writer.read { db in try SessionRecord.fetchOne(db, key: session.id) }
        return try #require(read)
    }

    @Test func pushCarriesTheStampAsISOWithZ() async throws {
        let store = try TestStore.make()
        _ = try await movedSession(store)
        let changes = try await store.outbox.pending(limit: 10).map(PushChange.init(entry:))
        #expect(changes.map(\.entity) == [.session, .session])
        #expect(changes[0].payload["dayMovedAt"] == .null)
        #expect(changes[1].payload["dayMovedAt"] == .string("2026-03-02T09:00:00.250Z"))
    }

    @Test func pullAppliesTheStamp() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let session = try await movedSession(remote.store)
        harness.transport.queuePull(PullResponse(changes: try await remote.takeChanges(), cursor: "2", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.database.writer.read { db in
            try SessionRecord.fetchOne(db, key: session.id)
        }
        #expect(local?.dayMovedAt == session.dayMovedAt)
        #expect(local?.day == Fixtures.monday.adding(days: 7))
    }

    @Test func aPayloadFromBeforeV8ReadsAsNeverMoved() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let session = try await movedSession(remote.store)
        let changes = try await remote.takeChanges().map { change in
            var old = change
            old.payload["dayMovedAt"] = nil  // as written by a build before v8
            return old
        }
        harness.transport.queuePull(PullResponse(changes: changes, cursor: "2", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.database.writer.read { db in
            try SessionRecord.fetchOne(db, key: session.id)
        }
        #expect(local != nil)
        #expect(local?.dayMovedAt == nil)
    }
}
