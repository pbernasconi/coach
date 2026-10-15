import Foundation

/// What the Sync section of Settings shows. Exclusive states, so an enum (SCR-6).
nonisolated enum SyncSection: Equatable, Sendable {
    /// Demo data: never synced.
    case demo
    /// This build names no sync server.
    case unavailable
    /// Sync is wired up; the summary says how it is going.
    case available(SyncSummary)
}

/// The Sync section's rows when sync is available.
nonisolated struct SyncSummary: Equatable, Sendable {
    /// "Synced 2 min ago", "Syncing…", "Not set up", "Token rejected", "Offline".
    var status: String
    var isSyncing: Bool
    /// Whether a sync token is stored. Without one, "Sync now" is off.
    var hasToken: Bool

    /// "Sync now" works only with a token and while no sync is running.
    var canSyncNow: Bool { hasToken && !isSyncing }
}

/// The sync token sheet. The draft is never logged and never shown back once saved.
nonisolated struct TokenEditor: Equatable, Sendable, Identifiable {
    enum SaveStatus: Equatable, Sendable {
        case idle
        case saving
        case failed
    }

    var draft: String
    /// A token is stored, so the sheet offers Remove.
    var canRemove: Bool
    var save: SaveStatus = .idle

    /// One sheet at a time: a new draft updates it in place.
    var id: Int { 0 }

    /// The draft without surrounding spaces or line breaks (a pasted token often ends with one).
    var trimmedDraft: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }

    var canSave: Bool { !trimmedDraft.isEmpty && save != .saving }
}
