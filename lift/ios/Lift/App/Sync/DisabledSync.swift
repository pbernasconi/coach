import LiftCore
import LiftSync

/// The `Syncing` for demo data, which is never synced, and for a build without a server URL. It never touches the
/// network or the Keychain; its status is always "not set up".
final class DisabledSync: Syncing {
    static let status = SyncStatus(phase: .failed(.notConfigured), lastSyncedAt: nil)

    let isConfigured = false

    @discardableResult
    func syncNow() async -> SyncStatus {
        Self.status
    }

    func scheduleSync() async {}

    func statusUpdates() -> AsyncStream<SyncStatus> {
        let (stream, continuation) = AsyncStream.makeStream(of: SyncStatus.self)
        continuation.yield(Self.status)
        continuation.finish()
        return stream
    }

    func setToken(_: String?) async throws {
        throw AppError(.invalidInput, detail: "sync is off in this build")
    }

    func hasToken() async -> Bool {
        false
    }
}
