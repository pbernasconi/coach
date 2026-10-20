import Foundation

/// Applies a `lift://sync?code=…` link. `SyncEnrollmentLink` is the live one; tests record the calls.
@MainActor
protocol SyncEnrolling: AnyObject {
    /// Trades `code` for the sync token and syncs. The returned task finishes when both are done.
    @discardableResult
    func enroll(code: String) -> Task<Void, Never>
}

/// Connects Lift from a link (Coach Settings → Lift: a tap on the iPhone, or the camera on its QR code), so nobody
/// pastes a 64-character token. The link carries a one-time code that expires in 15 minutes; `Syncing` trades it for
/// the token over HTTPS at the compiled-in server, so a link can never send data elsewhere, and a leaked link is
/// useless once used. The shell shows Settings afterwards, where the Sync row says how the first sync went.
@MainActor
final class SyncEnrollmentLink: SyncEnrolling {
    private let sync: any Syncing

    init(sync: any Syncing) {
        self.sync = sync
    }

    @discardableResult
    func enroll(code: String) -> Task<Void, Never> {
        let sync = sync
        return Task {
            guard sync.isConfigured else {
                AppLog.sync.info("Sync link ignored: this build has no sync server")
                return
            }
            do {
                try await sync.redeem(enrollmentCode: code)
                let status = await sync.syncNow()
                AppLog.sync.info("Sync link connected; status \(String(describing: status), privacy: .public)")
            } catch {
                AppLog.sync.error("Sync link failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}
