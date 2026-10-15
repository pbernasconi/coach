import Foundation
import LiftSync

@testable import Lift

/// A scripted `Syncing` that records every call. `statusUpdates()` replays `statuses`, then finishes.
@MainActor
final class FakeSyncing: Syncing {
    var isConfigured = true
    var statuses: [SyncStatus] = []
    /// What `syncNow()` returns.
    var syncResult = SyncStatus(phase: .idle, lastSyncedAt: nil)
    var token: String?
    var setTokenError: (any Error)?
    private(set) var syncNowCount = 0
    private(set) var scheduleCount = 0
    /// Every value passed to `setToken(_:)`, in order.
    private(set) var savedTokens: [String?] = []

    func syncNow() async -> SyncStatus {
        syncNowCount += 1
        return syncResult
    }

    func scheduleSync() async {
        scheduleCount += 1
    }

    func statusUpdates() -> AsyncStream<SyncStatus> {
        let (stream, continuation) = AsyncStream.makeStream(of: SyncStatus.self)
        for status in statuses { continuation.yield(status) }
        continuation.finish()
        return stream
    }

    func setToken(_ token: String?) async throws {
        if let setTokenError { throw setTokenError }
        savedTokens.append(token)
        self.token = token
    }

    func hasToken() async -> Bool {
        token != nil
    }
}
