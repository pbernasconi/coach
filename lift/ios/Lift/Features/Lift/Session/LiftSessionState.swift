import Foundation
import LiftSync

/// Everything the read-only session screen renders (SCR-6): the coach's body for one session, and each exercise's
/// picture once its card appears.
nonisolated struct LiftSessionState: Equatable, Sendable {
    /// The lower-case session id the screen was opened with.
    let sessionID: String
    var detail = AppResourceState<LiftSessionDetail>()
    /// Each exercise's catalog picture, by exercise item id, loaded as its card appears.
    var media: [String: MediaImage] = [:]
    /// The exercises whose "How to" steps are open, by exercise item id.
    var expandedSteps: Set<String> = []
    /// The coach could not show this session (not synced yet, no token, offline with nothing kept), and this iPhone has
    /// it: the route shows the local workout instead.
    var localFallback: UUID?
}

extension LiftSessionDetail {
    /// The App API path of one session (lift/APP-API.md, "Session").
    static func path(_ sessionID: String) -> String {
        LiftLinks.sessionPath(sessionID)
    }
}
