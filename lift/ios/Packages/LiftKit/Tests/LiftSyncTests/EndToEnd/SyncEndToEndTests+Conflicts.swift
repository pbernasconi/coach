import Foundation
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

extension SyncEndToEndTests {
    /// Last writer wins per row by `updatedAt` (SYNC.md), across two phones and the server.
    @Suite struct LastWriterWins {
        @Test func aNewerEditOnBReachesA() async throws {
            let pair = try await syncedPair()
            let (deviceA, deviceB, ids, setID) = (pair.deviceA, pair.deviceB, pair.ids, pair.setID)
            defer { [deviceA, deviceB].forEach { $0.remove() } }
            deviceB.now.advance(seconds: 60)
            _ = try await deviceB.sets.saveValues(setID: setID, reps: 3, weight: .kg(111.5))
            #expect(await deviceB.engine.syncNow().phase == .idle)
            #expect(await deviceA.engine.syncNow().phase == .idle)
            #expect(try await deviceA.set(setID)?.actualReps == 3)
            #expect(try await deviceA.set(setID)?.actualWeight == .kg(111.5))
            #expect(try await deviceA.snapshot(ids) == deviceB.snapshot(ids))
        }

        /// A's clock is behind B's edit, but A edits after pulling it: the edit is stamped just past B's version, so
        /// it wins everywhere. Before the fix the server dropped it as older while A kept it, and they disagreed.
        @Test func anEditMadeAfterPullingWinsEvenWithASlowClock() async throws {
            let pair = try await syncedPair()
            let (deviceA, deviceB, ids, setID) = (pair.deviceA, pair.deviceB, pair.ids, pair.setID)
            defer { [deviceA, deviceB].forEach { $0.remove() } }
            deviceB.now.advance(seconds: 600)
            _ = try await deviceB.sets.saveValues(setID: setID, reps: 3, weight: nil)
            #expect(await deviceB.engine.syncNow().phase == .idle)
            #expect(await deviceA.engine.syncNow().phase == .idle)

            deviceA.now.advance(seconds: 30)  // still ten minutes behind B
            _ = try await deviceA.sets.saveValues(setID: setID, reps: 9, weight: nil)
            let bStamp = try #require(try await deviceB.set(setID)?.updatedAt)
            #expect(try #require(try await deviceA.set(setID)?.updatedAt) > bStamp)
            #expect(await deviceA.engine.syncNow().phase == .idle)
            #expect(await deviceB.engine.syncNow().phase == .idle)
            #expect(try await deviceB.set(setID)?.actualReps == 9)
            #expect(try await deviceA.snapshot(ids) == deviceB.snapshot(ids))
        }

        /// Concurrent edits: B's is later by `updatedAt`, but A pushes its older one after B's. The server keeps
        /// B's, and A converges to it on the same sync.
        @Test func concurrentEditsConvergeOnTheLaterOne() async throws {
            let pair = try await syncedPair()
            let (deviceA, deviceB, ids, setID) = (pair.deviceA, pair.deviceB, pair.ids, pair.setID)
            defer { [deviceA, deviceB].forEach { $0.remove() } }
            deviceB.now.advance(seconds: 600)
            deviceA.now.advance(seconds: 300)
            _ = try await deviceB.sets.saveValues(setID: setID, reps: 4, weight: .kg(95))
            _ = try await deviceA.sets.saveValues(setID: setID, reps: 12, weight: nil)
            #expect(await deviceB.engine.syncNow().phase == .idle)
            #expect(await deviceA.engine.syncNow().phase == .idle)

            let fresh = try E2EDevice(now: .e2e())
            defer { fresh.remove() }
            #expect(await fresh.engine.syncNow().phase == .idle)
            #expect(try await fresh.set(setID)?.actualReps == 4)
            #expect(try await deviceA.set(setID)?.actualReps == 4)
            #expect(try await deviceA.snapshot(ids) == fresh.snapshot(ids))
            #expect(try await deviceB.snapshot(ids) == fresh.snapshot(ids))
        }

        /// A writes a workout and both phones sync, so both hold it.
        private func syncedPair() async throws -> SyncedPair {
            let (deviceA, deviceB) = try E2EDevice.pair()
            let ids = try await deviceA.writeWorkout()
            #expect(await deviceA.engine.syncNow().phase == .idle)
            #expect(await deviceB.engine.syncNow().phase == .idle)
            return SyncedPair(deviceA: deviceA, deviceB: deviceB, ids: ids, setID: try #require(ids.liveSet))
        }
    }
}

/// Two phones holding the same synced workout, and the live set the conflict tests edit.
private struct SyncedPair {
    let deviceA: E2EDevice
    let deviceB: E2EDevice
    let ids: E2EIDs
    let setID: UUID
}
