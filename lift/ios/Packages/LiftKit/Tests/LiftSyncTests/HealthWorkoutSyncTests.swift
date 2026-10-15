import Foundation
import GRDB
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import LiftStore

/// `session.healthWorkoutID` (v5) travels as a UUID string and is applied from pulls, so a second device never saves
/// the same workout to Apple Health again.
@Suite struct HealthWorkoutSyncTests {
    private static let workoutID = UUID(uuid: (0xEE, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 2))

    private func finishedSession(_ store: TestStore) async throws -> SessionRecord {
        let session = try await store.sessions.createSession(
            on: Fixtures.monday,
            title: "Lower A",
            unit: .kg,
            templateID: nil
        )
        try await store.sessions.setHealthWorkoutID(Self.workoutID, forSession: session.id)
        return session
    }

    @Test func pushCarriesTheIDAsAString() async throws {
        let store = try TestStore.make()
        _ = try await finishedSession(store)
        let changes = try await store.outbox.pending(limit: 10).map(PushChange.init(entry:))
        #expect(changes.last?.payload["healthWorkoutID"] == .string(Self.workoutID.uuidString))
        #expect(changes.first?.payload["healthWorkoutID"] == .null)
    }

    @Test func pullAppliesTheID() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let session = try await finishedSession(remote.store)
        harness.transport.queuePull(PullResponse(changes: try await remote.takeChanges(), cursor: "2", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.sessions.healthSession(id: session.id)
        #expect(local?.healthWorkoutID == Self.workoutID)
    }

    @Test func aPayloadFromBeforeV5ReadsAsNoWorkout() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let session = try await finishedSession(remote.store)
        let changes = try await remote.takeChanges().map { change in
            var old = change
            old.payload["healthWorkoutID"] = nil  // as written by a build before v5
            return old
        }
        harness.transport.queuePull(PullResponse(changes: changes, cursor: "2", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.sessions.healthSession(id: session.id)
        #expect(local != nil)
        #expect(local?.healthWorkoutID == nil)
    }
}
