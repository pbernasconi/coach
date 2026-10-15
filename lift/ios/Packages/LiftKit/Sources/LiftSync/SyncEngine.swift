import Foundation
import LiftStore

/// Pushes the outbox, then pulls remote changes (SYNC.md, DATA-3, DATA-4). An actor because it owns shared
/// mutable state: the in-flight sync and the debounce timer (CONC-3). One sync runs at a time; a call that
/// arrives while one is running waits for it and gets its result.
public actor SyncEngine {
    /// The most changes in one push request, and the pull page size (SYNC.md).
    public static let batchSize = 500

    private let outbox: any OutboxRepository
    private let state: any SyncStateRepository
    private let transport: any SyncTransport
    private let now: @Sendable () -> Date
    private let clock: any Clock<Duration>
    private let debounce: Duration
    private let status: SyncStatusBroadcaster

    private var inFlight: Task<SyncStatus, Never>?
    private var pendingSchedule: Task<Void, Never>?
    /// How many `syncNow()` calls joined a running sync instead of starting one.
    private(set) var coalescedCount = 0

    /// `debounce` is how long `scheduleSync()` waits after the last local write before syncing.
    public init(
        outbox: any OutboxRepository,
        state: any SyncStateRepository,
        transport: any SyncTransport,
        now: @escaping @Sendable () -> Date,
        clock: any Clock<Duration>,
        debounce: Duration = .seconds(3)
    ) {
        self.outbox = outbox
        self.state = state
        self.transport = transport
        self.now = now
        self.clock = clock
        self.debounce = debounce
        self.status = SyncStatusBroadcaster(.initial)
    }

    /// The status now, then every change. One stream per subscriber.
    public nonisolated func statusUpdates() -> AsyncStream<SyncStatus> {
        status.stream()
    }

    /// The latest status.
    public nonisolated var currentStatus: SyncStatus {
        status.current
    }

    /// Push then pull now. Overlapping calls share one run. Never throws: the outcome is the returned status,
    /// which is also published on `statusUpdates()`.
    @discardableResult
    public func syncNow() async -> SyncStatus {
        if let inFlight {
            coalescedCount += 1
            return await inFlight.value
        }
        let task = Task { await self.run() }
        inFlight = task
        let result = await task.value
        inFlight = nil
        return result
    }

    /// Syncs after `debounce` of quiet: call after every local write. A newer call restarts the wait.
    public func scheduleSync() {
        pendingSchedule?.cancel()
        let clock = clock
        let debounce = debounce
        pendingSchedule = Task {
            do {
                try await clock.sleep(for: debounce)
            } catch {
                return  // a newer write restarted the wait (CONC-7)
            }
            await self.syncNow()
        }
    }

    private func run() async -> SyncStatus {
        let last = (try? await state.lastSyncedAt()) ?? status.current.lastSyncedAt
        status.publish(SyncStatus(phase: .syncing, lastSyncedAt: last))
        do {
            try await pushAll()
            try await pullAll()
            let stamp = now()
            try await state.setLastSyncedAt(stamp)
            status.publish(SyncStatus(phase: .idle, lastSyncedAt: stamp))
        } catch is CancellationError {
            status.publish(SyncStatus(phase: .idle, lastSyncedAt: last))
        } catch {
            let failure = SyncFailure(error)
            SyncLog.failed(failure)
            status.publish(SyncStatus(phase: .failed(failure), lastSyncedAt: last))
        }
        return status.current
    }

    /// Pushes the outbox oldest first in batches of `batchSize`. Accepted and rejected entries leave the
    /// outbox; anything else (a retryable error, a key the server did not mention) stays for the next sync.
    private func pushAll() async throws {
        let deviceID = try await state.deviceID().uuidString
        while true {
            let entries = try await outbox.pending(limit: Self.batchSize)
            guard !entries.isEmpty else { return }
            var changes: [PushChange] = []
            var done: [UUID] = []
            for entry in entries {
                if let change = try? PushChange(entry: entry) {
                    changes.append(change)
                } else {
                    done.append(entry.id)  // a payload that cannot be read can never succeed
                }
            }
            if !done.isEmpty { SyncLog.unreadableEntries(done.count) }
            if !changes.isEmpty {
                let response = try await transport.push(PushRequest(deviceId: deviceID, changes: changes))
                if !response.rejected.isEmpty { SyncLog.rejected(response.rejected.count) }
                let keys = response.acknowledgedKeys
                done += entries.filter { keys.contains($0.idempotencyKey) }.map(\.id)
            }
            guard !done.isEmpty else { return }
            try await outbox.acknowledge(done)
            guard done.count == entries.count, entries.count == Self.batchSize else { return }
        }
    }

    /// Pulls pages from the stored cursor until `hasMore` is false. Rows that wait for a parent are carried
    /// into the next page's transaction.
    private func pullAll() async throws {
        var cursor = try await state.pullCursor()
        var carried: [RemoteChange] = []
        while true {
            let response = try await transport.pull(cursor: cursor, limit: Self.batchSize)
            if response.droppedCount > 0 { SyncLog.droppedChanges(response.droppedCount) }
            let page = PulledPage(
                changes: carried + response.changes,
                cursor: response.cursor ?? cursor,
                isFinal: !response.hasMore
            )
            carried = try await state.apply(page).deferred
            if page.isFinal { return }
            guard let next = response.cursor, next != cursor else { throw SyncTransportError.invalidResponse }
            cursor = next
        }
    }
}
