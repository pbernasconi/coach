import Foundation

/// Applies a `lift://sync?token=…` link. `SyncTokenLink` is the live one; tests record the calls.
@MainActor
protocol SyncTokenApplying: AnyObject {
    /// Stores `token` as the sync token and syncs. The returned task finishes when both are done.
    @discardableResult
    func apply(token: String) -> Task<Void, Never>
}

/// Stores the token from a `lift://sync` link (the coach web app's Settings → Connect Lift) and syncs at once, so a
/// tap on the iPhone replaces pasting a 64-character token. The server URL is compiled in, so a link can only change
/// the token, never where data goes. A build without a server (or demo data) ignores the link. The shell shows
/// Settings after a sync link, where the Sync row says how the first sync went.
@MainActor
final class SyncTokenLink: SyncTokenApplying {
    private let sync: any Syncing

    init(sync: any Syncing) {
        self.sync = sync
    }

    @discardableResult
    func apply(token: String) -> Task<Void, Never> {
        let sync = sync
        return Task {
            guard sync.isConfigured else {
                AppLog.sync.info("Sync link ignored: this build has no sync server")
                return
            }
            do {
                try await sync.setToken(token)
                let status = await sync.syncNow()
                AppLog.sync.info("Sync link applied; status \(String(describing: status), privacy: .public)")
            } catch {
                AppLog.sync.error("Sync link could not store the token: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}
