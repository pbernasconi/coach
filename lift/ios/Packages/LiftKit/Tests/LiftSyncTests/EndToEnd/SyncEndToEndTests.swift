import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// The real store and `SyncEngine` against the live coach server and Postgres (SYNC.md). Opt-in: runs only
/// when `LIFT_SYNC_E2E_URL` is set, which `lift/scripts/sync-e2e.sh` does after starting both.
/// Serialized, nested suites included, because the scenarios share one server; each uses fresh devices and random ids.
@Suite(.serialized, .enabled(if: E2EConfig.isEnabled, "set LIFT_SYNC_E2E_URL (lift/scripts/sync-e2e.sh)"))
struct SyncEndToEndTests {
    @Test func deviceBPullsTheRowsDeviceAPushed() async throws {
        let (deviceA, deviceB) = try E2EDevice.pair()
        defer { [deviceA, deviceB].forEach { $0.remove() } }

        let ids = try await deviceA.writeWorkout()
        #expect(try await deviceA.pendingCount() > ids.count)  // edits and deletes add entries
        #expect(await deviceA.engine.syncNow().phase == .idle)
        #expect(try await deviceA.pendingCount() == 0)

        #expect(await deviceB.engine.syncNow().phase == .idle)
        let expected = try await deviceA.snapshot(ids)
        #expect(expected.count == ids.count)
        let pulled = try await deviceB.snapshot(ids)
        #expect(pulled == expected, "\(pulled.differences(from: expected))")
        #expect(try await deviceB.pendingCount() == 0)  // pulled rows never enter the outbox
        #expect(try await deviceB.state.pullCursor() != nil)
    }

    @Test func rePushingAppliedChangesIsANoOp() async throws {
        let deviceA = try E2EDevice(now: .e2e())
        defer { deviceA.remove() }
        _ = try await deviceA.writeWorkout()
        let entries = try await deviceA.outbox.pending(limit: 1000)
        let changes = try entries.map(PushChange.init(entry:))
        let deviceID = try await deviceA.state.deviceID().uuidString
        #expect(await deviceA.engine.syncNow().phase == .idle)
        let cursor = try #require(try await deviceA.state.pullCursor())

        // The same idempotency keys again (as after a response lost on the way back): all accepted, nothing
        // stored again, so nothing new to pull.
        let again = try await deviceA.transport.push(PushRequest(deviceId: deviceID, changes: changes))
        #expect(Set(again.accepted.map { $0.lowercased() }) == Set(changes.map { $0.idempotencyKey.lowercased() }))
        #expect(again.rejected.isEmpty)
        let page = try await deviceA.transport.pull(cursor: cursor, limit: 500)
        let mine = Set(entries.map(\.rowID))
        #expect(!page.changes.contains { mine.contains($0.rowID) })
    }

    @Test func aWrongTokenGets401AndKeepsTheOutbox() async throws {
        let device = try E2EDevice(now: .e2e(), token: "wrong-\(UUID().uuidString)")
        defer { device.remove() }
        _ = try await device.writeWorkout()
        let pending = try await device.pendingCount()

        let status = await device.engine.syncNow()
        #expect(status.phase == .failed(.unauthorized))
        #expect(status.lastSyncedAt == nil)
        #expect(try await device.pendingCount() == pending)
        await #expect(throws: SyncTransportError.unauthorized) {
            try await device.transport.pull(cursor: nil, limit: 1)
        }
        await #expect(throws: SyncTransportError.missingToken) {
            try await RecordingTransport(baseURL: try E2EDevice.requireBaseURL(), token: "").pull(cursor: nil, limit: 1)
        }
    }

    @Test func datesRoundTripWithMilliseconds() async throws {
        let (deviceA, deviceB) = try E2EDevice.pair()
        defer { [deviceA, deviceB].forEach { $0.remove() } }
        let ids = try await deviceA.writeWorkout()
        #expect(await deviceA.engine.syncNow().phase == .idle)

        // On the wire: ISO 8601, milliseconds, Z, for every date column.
        let pulled = try await deviceB.transport.pull(cursor: nil, limit: 500)
        var seen = 0
        for change in pulled.changes where ids.contains(change.rowID) {
            for column in ["createdAt", "updatedAt", "deletedAt", "startedAt", "finishedAt", "completedAt"] {
                guard let text = change.payload[column]?.stringValue else { continue }
                let iso = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/
                #expect(text.wholeMatch(of: iso) != nil, "\(column): \(text)")
                seen += 1
            }
        }
        #expect(seen > 0 || pulled.hasMore)

        #expect(await deviceB.engine.syncNow().phase == .idle)
        let setID = try #require(ids.liveSet)
        let a = try #require(try await deviceA.set(setID))
        let b = try #require(try await deviceB.set(setID))
        #expect(b.createdAt == a.createdAt)
        #expect(b.updatedAt == a.updatedAt)
        #expect(b.completedAt == a.completedAt)
        #expect(Int((b.updatedAt.timeIntervalSince1970 * 1000).rounded()) % 1000 != 0)  // the .123 survived
        #expect(try await deviceB.snapshot(ids) == deviceA.snapshot(ids))
    }
}
