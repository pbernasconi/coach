import Foundation
import GRDB
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import LiftStore

@Suite struct PullTests {
    @Test func pullInsertsAllFourEntitiesWithoutOutboxEntries() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let written = try await remote.writeWorkout()
        harness.transport.queuePull(PullResponse(changes: try await remote.takeChanges(), cursor: "4", hasMore: false))
        let status = await harness.engine.syncNow()
        #expect(status.phase == .idle)
        let local = try await harness.store.database.writer.read { db in
            (
                try ExerciseRow.fetchOne(db, key: written.exercise.id)?.exercise,
                try SessionRecord.exists(db, key: written.slot.sessionID),
                try SessionExerciseRecord.fetchOne(db, key: written.slot.id)
            )
        }
        #expect(local.0 == written.exercise)
        #expect(local.1)
        #expect(local.2 == written.slot)
        #expect(try await localSet(written.set.id, harness) == written.set)
        #expect(try await harness.pendingCount() == 0)
        #expect(try await harness.syncState.pullCursor() == "4")
    }

    @Test func newerRemoteUpdatesAndDeletesWin() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let set = try await remote.writeWorkout().set
        try await pull(try await remote.takeChanges(), into: harness)
        remote.store.now.advance(seconds: 60)
        _ = try await remote.store.sets.saveValues(setID: set.id, reps: 4, weight: .kg(102.5))
        remote.store.now.advance(seconds: 1)
        try await remote.store.sets.remove(setID: set.id)
        try await pull(try await remote.takeChanges(), into: harness)
        let local = try #require(try await localSet(set.id, harness))
        #expect(local.actualReps == 4)
        #expect(local.actualWeight == .kg(102.5))
        #expect(local.deletedAt == ManualNow.start.addingTimeInterval(61))
        #expect(try await harness.pendingCount() == 0)
    }

    @Test func olderRemoteChangeDoesNotOverwriteANewerLocalEdit() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let set = try await remote.writeWorkout().set
        try await pull(try await remote.takeChanges(), into: harness)
        harness.store.now.advance(seconds: 120)
        _ = try await harness.store.sets.saveValues(setID: set.id, reps: 8, weight: nil)
        remote.store.now.advance(seconds: 60)
        _ = try await remote.store.sets.saveValues(setID: set.id, reps: 3, weight: nil)
        try await pull(try await remote.takeChanges(), into: harness)
        #expect(try await localSet(set.id, harness)?.actualReps == 8)
    }

    @Test func reapplyingAPageChangesNothing() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        _ = try await remote.writeWorkout()
        let page = PulledPage(changes: try await remote.takeChanges(), cursor: "4", isFinal: true)
        let first = try await harness.syncState.apply(page)
        let second = try await harness.syncState.apply(page)
        #expect(first.applied == 4)
        #expect(second.applied == 0)
        #expect(second.stale == 4)
        #expect(try await harness.pendingCount() == 0)
    }

    @Test func childrenWaitForAParentFromALaterPage() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        _ = try await remote.writeWorkout()
        let changes = try await remote.takeChanges()
        let children = changes.filter { $0.entity == .sessionExercise || $0.entity == .set }
        let parents = changes.filter { $0.entity == .exercise || $0.entity == .session }
        let first = try await harness.syncState.apply(PulledPage(changes: children, cursor: "2", isFinal: false))
        #expect(first.deferred == children)
        #expect(first.storedCursor == false)
        #expect(try await harness.syncState.pullCursor() == nil)
        let next = PulledPage(changes: first.deferred + parents, cursor: "4", isFinal: true)
        let second = try await harness.syncState.apply(next)
        #expect(second.applied == 4)
        #expect(second.deferred.isEmpty)
        #expect(try await harness.syncState.pullCursor() == "4")
    }

    @Test func engineCarriesWaitingChildrenAcrossPages() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let set = try await remote.writeWorkout().set
        let changes = try await remote.takeChanges()
        harness.transport.queuePull(
            PullResponse(changes: changes.filter { $0.entity == .set }, cursor: "1", hasMore: true)
        )
        harness.transport.queuePull(
            PullResponse(changes: changes.filter { $0.entity != .set }, cursor: "4", hasMore: false)
        )
        await harness.engine.syncNow()
        #expect(try await localSet(set.id, harness) == set)
        #expect(harness.transport.pullCursors == [nil, "1"])
    }

    @Test func undecodableRowsAreSkipped() async throws {
        let harness = try SyncHarness()
        let bad = RemoteChange(entity: .session, rowID: IDSequence.id(1), payload: ["id": .string("nope")])
        let result = try await harness.syncState.apply(PulledPage(changes: [bad], cursor: "1", isFinal: true))
        #expect(result.invalid == 1)
        #expect(result.applied == 0)
    }

    private func pull(_ changes: [RemoteChange], into harness: SyncHarness) async throws {
        harness.transport.queuePull(PullResponse(changes: changes, cursor: "c\(changes.count)", hasMore: false))
        let status = await harness.engine.syncNow()
        #expect(status.phase == .idle)
    }

    private func localSet(_ id: UUID, _ harness: SyncHarness) async throws -> SetRecord? {
        try await harness.store.database.writer.read { db in try SetRecord.fetchOne(db, key: id) }
    }
}
