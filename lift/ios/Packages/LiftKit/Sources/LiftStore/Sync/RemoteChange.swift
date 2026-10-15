import Foundation

/// One row from a pull: the server's latest version of `rowID`, as a wire payload (SYNC.md).
public struct RemoteChange: Hashable, Sendable {
    public var entity: OutboxEntity
    public var rowID: UUID
    public var payload: [String: JSONValue]

    public init(entity: OutboxEntity, rowID: UUID, payload: [String: JSONValue]) {
        self.entity = entity
        self.rowID = rowID
        self.payload = payload
    }
}

/// One pull page to apply in a single transaction. `cursor` is stored with it unless rows had to wait for
/// a parent that has not arrived yet (see `PullApplyResult.deferred`).
public struct PulledPage: Hashable, Sendable {
    public var changes: [RemoteChange]
    public var cursor: String?
    /// The server said `hasMore: false`: the cursor is stored even if some rows are still waiting.
    public var isFinal: Bool

    public init(changes: [RemoteChange], cursor: String?, isFinal: Bool) {
        self.changes = changes
        self.cursor = cursor
        self.isFinal = isFinal
    }
}

/// What applying a page did.
public struct PullApplyResult: Hashable, Sendable {
    /// Rows inserted or overwritten because the remote `updatedAt` was newer.
    public var applied = 0
    /// Rows skipped because the local copy is as new or newer (last writer wins).
    public var stale = 0
    /// Rows that could not be decoded; skipped and logged.
    public var invalid = 0
    /// Rows whose parent row is missing locally. Pass them again with the next page, whose rows may hold
    /// the parent (a parent edited after its children has a later sequence number).
    public var deferred: [RemoteChange] = []
    /// Whether the page's cursor was stored.
    public var storedCursor = false

    public init() {}
}

/// The sync engine's local state and the pull side of the store (SYNC.md). Applying pulled rows never
/// appends outbox entries: they are remote changes, not local writes.
public protocol SyncStateRepository: Sendable {
    /// This install's stable device id, created on first use.
    func deviceID() async throws -> UUID

    /// The stored pull cursor; nil before the first full pull.
    func pullCursor() async throws -> String?

    /// When the last sync finished without error.
    func lastSyncedAt() async throws -> Date?

    func setLastSyncedAt(_ date: Date) async throws

    /// Applies one page with last-writer-wins by `updatedAt`, in one transaction with its cursor.
    func apply(_ page: PulledPage) async throws -> PullApplyResult
}
