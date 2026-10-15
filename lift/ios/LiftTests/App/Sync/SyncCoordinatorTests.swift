import LiftSync
import Testing

@testable import Lift

/// When the app syncs: after launch, on returning to the foreground, and after the outbox grows.
@MainActor
@Suite struct SyncCoordinatorTests {
    let sync = FakeSyncing()

    @Test func launchedSyncsOnce() async {
        let coordinator = SyncCoordinator(sync: sync, outbox: FakeOutboxCounts(counts: []))

        await coordinator.launched()
        await coordinator.launched()

        #expect(sync.syncNowCount == 1)
    }

    @Test func becomingActiveBeforeLaunchDoesNothing() async {
        let coordinator = SyncCoordinator(sync: sync, outbox: FakeOutboxCounts(counts: []))

        await coordinator.sceneBecameActive()

        #expect(sync.syncNowCount == 0)
    }

    @Test func becomingActiveAfterLaunchSyncs() async {
        let coordinator = SyncCoordinator(sync: sync, outbox: FakeOutboxCounts(counts: []))
        await coordinator.launched()

        await coordinator.sceneBecameActive()
        await coordinator.sceneBecameActive()

        #expect(sync.syncNowCount == 3)
    }

    @Test func outboxGrowthSchedulesASync() async {
        // 2 is the baseline; 3 and 4 are local writes; 2 → 2 and 3 → 1 are not.
        let coordinator = SyncCoordinator(sync: sync, outbox: FakeOutboxCounts(counts: [2, 2, 3, 1, 4]))

        await coordinator.watchOutbox()

        #expect(sync.scheduleCount == 2)
        #expect(sync.syncNowCount == 0)
    }

    @Test func theFirstCountIsOnlyTheBaseline() async {
        let coordinator = SyncCoordinator(sync: sync, outbox: FakeOutboxCounts(counts: [5]))

        await coordinator.watchOutbox()

        #expect(sync.scheduleCount == 0)
    }
}
