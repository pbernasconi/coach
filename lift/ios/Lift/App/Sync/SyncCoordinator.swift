import LiftStore

/// When the app syncs (SYNC.md, "Client schedule"): once after launch, whenever the app returns to the foreground,
/// and a few seconds after local writes (the engine debounces). Logging never waits for any of it.
final class SyncCoordinator {
    private let sync: any Syncing
    private let outbox: any OutboxRepository
    private var hasLaunched = false

    init(sync: any Syncing, outbox: any OutboxRepository) {
        self.sync = sync
        self.outbox = outbox
    }

    /// Call once `AppDependencies.prepare()` has finished.
    func launched() async {
        guard !hasLaunched else { return }
        hasLaunched = true
        await sync.syncNow()
    }

    /// The scene became active. Ignored until launch, which syncs by itself.
    func sceneBecameActive() async {
        guard hasLaunched else { return }
        await sync.syncNow()
    }

    /// Runs for as long as the calling task: schedules a sync each time the outbox grows (a local write). The first
    /// count is the baseline; a shrinking count is a sync removing pushed entries.
    func watchOutbox() async {
        var last: Int?
        for await count in outbox.observePendingCount() {
            if let last, count > last {
                await sync.scheduleSync()
            }
            last = count
        }
    }
}
