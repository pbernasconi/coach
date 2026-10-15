import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

extension SyncEndToEndTests {
    /// Batching, paging and soft deletes.
    @Suite struct Volume {
        @Test func moreThan500ChangesPushInBatchesAndPullInPages() async throws {
            let (deviceA, deviceB) = try E2EDevice.pair()
            defer { [deviceA, deviceB].forEach { $0.remove() } }
            let ids = try await deviceA.writeVolumeDay(sets: 520)
            #expect(try await deviceA.pendingCount() == 524)

            #expect(await deviceA.engine.syncNow().phase == .idle)
            #expect(deviceA.transport.log.pushSizes == [500, 24])
            #expect(try await deviceA.pendingCount() == 0)

            #expect(await deviceB.engine.syncNow().phase == .idle)
            let pulls = deviceB.transport.log.pulls
            #expect(pulls.count >= 2)
            #expect(pulls.first?.hasMore == true)
            #expect(pulls.first?.count == 500)
            #expect(pulls.last?.hasMore == false)
            let everyPageButTheLastHasMore = pulls.dropLast().allSatisfy(\.hasMore)
            #expect(everyPageButTheLastHasMore)
            let expected = try await deviceA.snapshot(ids)
            #expect(expected.count == 523)
            let pulled = try await deviceB.snapshot(ids)
            #expect(pulled == expected, "\(pulled.differences(from: expected))")
        }

        @Test func deletesPropagateAsTombstones() async throws {
            let (deviceA, deviceB) = try E2EDevice.pair()
            defer { [deviceA, deviceB].forEach { $0.remove() } }
            let ids = try await deviceA.writeWorkout()
            #expect(await deviceA.engine.syncNow().phase == .idle)
            #expect(await deviceB.engine.syncNow().phase == .idle)

            deviceA.now.advance(seconds: 5)
            let setID = try #require(ids.liveSet)
            try await deviceA.sets.remove(setID: setID)
            let slotID = try #require(ids.sessionExercises.first)
            try await deviceA.sessions.removeExercise(id: slotID)
            let sessionID = try #require(ids.sessions.first)
            _ = try await deviceA.sessions.reschedule(sessionID, .remove)
            #expect(await deviceA.engine.syncNow().phase == .idle)

            // The server keeps the rows, with deletedAt set, and hands them out as ordinary changes.
            let pulled = try await deviceB.transport.pull(cursor: try await deviceB.state.pullCursor(), limit: 500)
            let tombstones = pulled.changes.filter { [setID, slotID, sessionID].contains($0.rowID) }
            #expect(tombstones.count == 3)
            #expect(tombstones.allSatisfy { $0.payload["deletedAt"]?.stringValue != nil })

            #expect(await deviceB.engine.syncNow().phase == .idle)
            let onB = try await deviceB.snapshot(ids)
            #expect(onB == (try await deviceA.snapshot(ids)))
            #expect(onB.sets[setID]?["deletedAt"]?.isNull == false)
            #expect(onB.sessionExercises[slotID]?["deletedAt"]?.isNull == false)
            #expect(onB.sessions[sessionID]?["deletedAt"]?.isNull == false)
            // Hidden from B's screens, like on A.
            let week = await deviceB.sessions.observeSessions(
                from: Fixtures.monday,
                through: Fixtures.monday.adding(days: 6)
            )
            .first { _ in true }
            #expect(week?.contains { $0.session.id == sessionID } == false)
        }
    }
}
