import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

@Suite struct PushTests {
    @Test func pushSendsTheOutboxOldestFirstInTheContractShape() async throws {
        let harness = try SyncHarness()
        let set = try await harness.store.writeLocalSet()
        let entries = try await harness.store.outbox.pending(limit: 10)
        let status = await harness.engine.syncNow()
        let body = try #require(harness.transport.pushes.first)
        #expect(body.deviceId == (try await harness.syncState.deviceID().uuidString))
        #expect(body.changes.map(\.idempotencyKey) == entries.map(\.idempotencyKey.uuidString))
        #expect(body.changes.map(\.entity) == [.session, .sessionExercise, .set])
        #expect(body.changes.map(\.op) == [.insert, .insert, .insert])
        let payload = try #require(body.changes.last?.payload)
        #expect(payload["id"] == .string(set.id.uuidString))
        #expect(payload["updatedAt"] == .string("2026-03-02T09:00:00.000Z"))
        #expect(payload["deletedAt"] == .null)
        #expect(try await harness.pendingCount() == 0)
        #expect(status == SyncStatus(phase: .idle, lastSyncedAt: ManualNow.start))
    }

    @Test func pushSendsBatchesOfAtMost500() async throws {
        let harness = try SyncHarness()
        try await seedOutbox(harness.store, count: 1_201)
        await harness.engine.syncNow()
        #expect(harness.transport.pushes.map(\.changes.count) == [500, 500, 201])
        #expect(try await harness.pendingCount() == 0)
    }

    @Test func acceptedAndRejectedLeaveTheOutboxUnmentionedStay() async throws {
        let harness = try SyncHarness()
        _ = try await harness.store.writeLocalSet()
        harness.transport.queuePush(.acceptFirst(1))
        await harness.engine.syncNow()
        #expect(try await harness.pendingCount() == 2)
        harness.transport.queuePush(.rejectAll(reason: "invalid entity"))
        await harness.engine.syncNow()
        #expect(try await harness.pendingCount() == 0)
        #expect(harness.transport.pushes.map(\.changes.count) == [3, 2])
    }

    @Test func retryableErrorKeepsEntriesAndSkipsThePull() async throws {
        let harness = try SyncHarness()
        _ = try await harness.store.writeLocalSet()
        harness.transport.queuePush(.fail(.retryable(status: 503)))
        let status = await harness.engine.syncNow()
        #expect(status.phase == .failed(.offline))
        #expect(status.lastSyncedAt == nil)
        #expect(try await harness.pendingCount() == 3)
        #expect(harness.transport.pullCursors.isEmpty)
    }

    @Test func rejectedRequestKeepsEntries() async throws {
        let harness = try SyncHarness()
        _ = try await harness.store.writeLocalSet()
        harness.transport.queuePush(.fail(.rejected(status: 400)))
        let status = await harness.engine.syncNow()
        #expect(status.phase == .failed(.rejected(status: 400)))
        #expect(try await harness.pendingCount() == 3)
    }

    @Test func aRetryResendsTheSameIdempotencyKeys() async throws {
        let harness = try SyncHarness()
        _ = try await harness.store.writeLocalSet()
        harness.transport.queuePush(.fail(.retryable(status: nil)))
        await harness.engine.syncNow()
        let status = await harness.engine.syncNow()
        let pushes = harness.transport.pushes
        #expect(pushes.count == 2)
        #expect(pushes[0] == pushes[1])
        #expect(status.phase == .idle)
        #expect(try await harness.pendingCount() == 0)
    }

    @Test func anUnreadablePayloadIsDroppedWithoutBlockingTheRest() async throws {
        let harness = try SyncHarness()
        try await seedOutbox(harness.store, count: 2, payload: "not json")
        _ = try await harness.store.writeLocalSet()
        await harness.engine.syncNow()
        #expect(harness.transport.pushes.map(\.changes.count) == [3])
        #expect(try await harness.pendingCount() == 0)
    }

    private func seedOutbox(_ store: TestStore, count: Int, payload: String? = nil) async throws {
        let ids = store.ids
        let stamp = ManualNow.start
        try await store.database.writer.write { db in
            for _ in 0..<count {
                let rowID = ids.next()
                let text = payload ?? #"{"id":"\#(rowID.uuidString)","updatedAt":"2026-03-02 09:00:00.000"}"#
                try OutboxEntry(
                    id: ids.next(),
                    entity: .exercise,
                    rowID: rowID,
                    op: .insert,
                    payload: text,
                    idempotencyKey: ids.next(),
                    createdAt: stamp
                )
                .insert(db)
            }
        }
    }
}
