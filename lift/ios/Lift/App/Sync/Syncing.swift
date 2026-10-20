import LiftSync

/// Sync as the app sees it (SYNC.md): push the outbox and pull, report the status, and keep the bearer token.
/// `LiveSync` wraps `SyncEngine` and the Keychain; `DisabledSync` stands in for demo data (never synced) and for a
/// build without a server URL.
@MainActor
protocol Syncing: AnyObject {
    /// False when this build cannot sync at all (no server URL, or demo data).
    var isConfigured: Bool { get }

    /// Push then pull now. Never throws: the outcome is the returned status, also published on `statusUpdates()`.
    @discardableResult
    func syncNow() async -> SyncStatus

    /// Syncs after a few quiet seconds. Call after local writes; a newer call restarts the wait.
    func scheduleSync() async

    /// The status now, then every change.
    func statusUpdates() -> AsyncStream<SyncStatus>

    /// Stores the bearer token, replacing any previous one; nil or blank removes it. Never logged.
    func setToken(_ token: String?) async throws

    /// Whether a token is stored.
    func hasToken() async -> Bool

    /// Trades a one-time enrollment code (from a `lift://sync?code=…` link) for the token at the server's
    /// `/api/lift/enroll`, and stores it. Throws when the code is invalid, used or expired, or the server is away.
    func redeem(enrollmentCode: String) async throws
}
