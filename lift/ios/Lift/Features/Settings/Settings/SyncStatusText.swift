import Foundation
import LiftSync

/// Plain copy for the Settings sync status row (ERR-1): each `SyncFailure` maps to a short label, and the last sync
/// is shown relative to `now`.
nonisolated enum SyncStatusText {
    /// Without a token the row reads "Not set up" whatever the last attempt said, unless a sync is running.
    static func describe(_ status: SyncStatus, hasToken: Bool, now: Date) -> String {
        switch status.phase {
        case .syncing:
            return String(localized: "Syncing…")
        case _ where !hasToken:
            return String(localized: "Not set up")
        case .failed(let failure):
            return text(for: failure)
        case .idle:
            guard let last = status.lastSyncedAt else { return String(localized: "Not synced yet") }
            return synced(at: last, now: now)
        }
    }

    static func text(for failure: SyncFailure) -> String {
        switch failure {
        case .notConfigured: String(localized: "Not set up")
        case .unauthorized: String(localized: "Token rejected")
        case .offline: String(localized: "Offline")
        case .rejected: String(localized: "Server refused the sync")
        case .invalidResponse: String(localized: "Server reply not recognised")
        case .storage: String(localized: "Data on this iPhone could not be read")
        }
    }

    /// "Synced just now", "Synced 2 min ago", "Synced 3 h ago", then the date and time.
    static func synced(at last: Date, now: Date) -> String {
        let seconds = max(0, Int(now.timeIntervalSince(last)))
        switch seconds {
        case ..<60:
            return String(localized: "Synced just now")
        case ..<3_600:
            let minutes = seconds / 60
            return String(localized: "Synced \(minutes) min ago")
        case ..<86_400:
            let hours = seconds / 3_600
            return String(localized: "Synced \(hours) h ago")
        default:
            let date = last.formatted(date: .abbreviated, time: .shortened)
            return String(localized: "Synced \(date)")
        }
    }
}
