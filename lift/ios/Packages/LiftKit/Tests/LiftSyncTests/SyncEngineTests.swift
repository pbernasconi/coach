import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import LiftSync

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

@Suite struct SyncEngineTests {
    @Test func cursorPersistsAcrossEngineInstances() async throws {
        let harness = try SyncHarness()
        harness.transport.queuePull(PullResponse(changes: [], cursor: "5", hasMore: true))
        harness.transport.queuePull(PullResponse(changes: [], cursor: "9", hasMore: false))
        await harness.engine.syncNow()
        await harness.relaunchedEngine().syncNow()
        #expect(harness.transport.pullCursors == [nil, "5", "9"])
        #expect(harness.transport.calls.contains(.pull(cursor: nil, limit: 500)))
    }

    @Test func overlappingCallsShareOneSync() async throws {
        let harness = try SyncHarness()
        _ = try await harness.store.writeLocalSet()
        harness.transport.holdPushes()
        let engine = harness.engine
        let first = Task { await engine.syncNow() }
        await harness.transport.waitForHeldPush()
        let second = Task { await engine.syncNow() }
        await eventually { await engine.coalescedCount == 1 }
        harness.transport.release()
        let results = [await first.value, await second.value]
        #expect(results[0] == results[1])
        #expect(results[0].phase == .idle)
        #expect(harness.transport.pushes.count == 1)
        #expect(harness.transport.pullCursors.count == 1)
    }

    @Test func unauthorizedStopsAndKeepsTheOutbox() async throws {
        let harness = try SyncHarness()
        _ = try await harness.store.writeLocalSet()
        harness.transport.queuePush(.fail(.unauthorized))
        let status = await harness.engine.syncNow()
        #expect(status == SyncStatus(phase: .failed(.unauthorized), lastSyncedAt: nil))
        #expect(try await harness.pendingCount() == 3)
        #expect(harness.transport.pullCursors.isEmpty)
    }

    @Test func unauthorizedPullFailsAfterAPush() async throws {
        let harness = try SyncHarness()
        harness.transport.queuePullFailure(.unauthorized)
        let status = await harness.engine.syncNow()
        #expect(status.phase == .failed(.unauthorized))
        #expect(try await harness.syncState.pullCursor() == nil)
    }

    @Test func missingTokenFailsAsNotConfiguredWithoutANetworkCall() async throws {
        let store = try TestStore.make()
        let transport = URLSessionSyncTransport(
            session: URLSession(configuration: .ephemeral),
            baseURL: try #require(URL(string: "https://coach.invalid")),
            tokens: StaticTokenProvider(nil)
        )
        let engine = SyncEngine(
            outbox: store.outbox,
            state: LiveSyncStateRepository(database: store.database) { store.ids.next() },
            transport: transport,
            now: { store.now() },
            clock: TestClock()
        )
        #expect(await engine.syncNow().phase == .failed(.notConfigured))
    }

    @Test func statusStreamReportsSyncingThenIdleWithLastSyncedAt() async throws {
        let harness = try SyncHarness()
        _ = try await harness.store.writeLocalSet()
        var updates = harness.engine.statusUpdates().makeAsyncIterator()
        #expect(await updates.next() == .initial)
        harness.transport.holdPushes()
        let engine = harness.engine
        let sync = Task { await engine.syncNow() }
        await harness.transport.waitForHeldPush()
        #expect(await updates.next() == SyncStatus(phase: .syncing, lastSyncedAt: nil))
        harness.transport.release()
        let finished = await sync.value
        #expect(await updates.next() == finished)
        #expect(finished.lastSyncedAt == ManualNow.start)
        #expect(try await harness.syncState.lastSyncedAt() == ManualNow.start)
    }

    @Test func lastSyncedAtSurvivesARelaunchAndAFailure() async throws {
        let harness = try SyncHarness()
        await harness.engine.syncNow()
        harness.transport.queuePullFailure(.retryable(status: nil))
        let status = await harness.relaunchedEngine().syncNow()
        #expect(status == SyncStatus(phase: .failed(.offline), lastSyncedAt: ManualNow.start))
    }

    @Test func scheduleSyncWaitsForQuietThenSyncsOnce() async throws {
        let harness = try SyncHarness()
        await harness.engine.scheduleSync()
        await eventually { harness.clock.sleeperCount == 1 }
        harness.clock.advance(by: .seconds(2))
        await harness.engine.scheduleSync()
        await eventually { harness.clock.sleeperCount == 1 }
        harness.clock.advance(by: .seconds(2))
        #expect(harness.transport.calls.isEmpty)
        let updates = harness.engine.statusUpdates()
        harness.clock.advance(by: .seconds(1))
        for await status in updates where status.lastSyncedAt != nil { break }
        #expect(harness.transport.pullCursors == [nil])
    }

    @Test func aRepeatedCursorWithMorePagesFails() async throws {
        let harness = try SyncHarness()
        harness.transport.queuePull(PullResponse(changes: [], cursor: nil, hasMore: true))
        let status = await harness.engine.syncNow()
        #expect(status.phase == .failed(.invalidResponse))
    }
}
