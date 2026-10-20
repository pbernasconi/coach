import Foundation
import GRDB
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import LiftStore

/// `workoutSet.rpe` (v7) travels as a number in the row JSON and is applied from pulls; a payload from a build before
/// v7 has no key and reads as no RPE (SYNC.md).
@Suite struct SetRPESyncTests {
    private func setWithRPE(_ store: TestStore) async throws -> SetRecord {
        let set = try await store.writeLocalSet()
        return try await store.sets.saveDetails(setID: set.id, rpe: 8.5, note: "Made-up note")
    }

    @Test func pushCarriesTheRPEAsANumber() async throws {
        let store = try TestStore.make()
        _ = try await setWithRPE(store)
        let changes = try await store.outbox.pending(limit: 10).map(PushChange.init(entry:))
        #expect(changes.map(\.entity) == [.session, .sessionExercise, .set, .set])
        #expect(changes[2].payload["rpe"] == .null)
        #expect(changes[3].payload["rpe"] == .double(8.5))
        #expect(changes[3].payload["note"] == .string("Made-up note"))
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let body = try encoder.encode(PushRequest(deviceId: "D", changes: changes))
        #expect(String(decoding: body, as: UTF8.self).contains(#""rpe":8.5"#))
    }

    @Test func pullAppliesTheRPE() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let set = try await setWithRPE(remote.store)
        harness.transport.queuePull(PullResponse(changes: try await remote.takeChanges(), cursor: "4", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.database.writer.read { db in try SetRecord.fetchOne(db, key: set.id) }
        #expect(local?.rpe == 8.5)
        #expect(local?.loggedSet == set.loggedSet)
    }

    @Test func aWholeNumberRPEPulledAsAnIntegerReadsBack() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let set = try await remote.store.writeLocalSet()
        _ = try await remote.store.sets.saveDetails(setID: set.id, rpe: 9, note: nil)
        let changes = try await remote.takeChanges().map { change in
            var wire = change
            if wire.entity == .set, wire.payload["rpe"] != .null { wire.payload["rpe"] = .integer(9) }
            return wire
        }
        harness.transport.queuePull(PullResponse(changes: changes, cursor: "4", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.database.writer.read { db in try SetRecord.fetchOne(db, key: set.id) }
        #expect(local?.rpe == 9)
    }

    @Test func aPayloadFromBeforeV7ReadsAsNoRPE() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let set = try await remote.store.writeLocalSet()
        let changes = try await remote.takeChanges().map { change in
            var old = change
            old.payload["rpe"] = nil  // as written by a build before v7
            return old
        }
        harness.transport.queuePull(PullResponse(changes: changes, cursor: "3", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.database.writer.read { db in try SetRecord.fetchOne(db, key: set.id) }
        #expect(local != nil)
        #expect(local?.rpe == nil)
    }
}
