import Foundation
import LiftSync

/// Everything the read-only session screen renders (SCR-6): the coach's body for one session, the exercise page open
/// over it, the "How did it feel" edits, and each exercise's picture once it shows.
nonisolated struct LiftSessionState: Equatable, Sendable {
    /// The lower-case session id the screen was opened with.
    let sessionID: String
    var detail = AppResourceState<LiftSessionDetail>()
    /// Each exercise's catalog picture, by exercise item id, loaded as its row appears.
    var media: [String: MediaImage] = [:]
    /// The exercises whose "How to" steps are open, by exercise item id.
    var expandedSteps: Set<String> = []
    /// The exercise page pushed over the session, or nil.
    var page: LiftSessionPage?
    var feedback = WorkoutFeedbackEdit()
    /// The coach could not show this session (not synced yet, no token, offline with nothing kept), and this iPhone has
    /// it: the route shows the local workout instead.
    var localFallback: UUID?

    /// The card's feedback: the edited copy, else the body's.
    var shownFeedback: WorkoutFeedback? {
        feedback.shown(detail.content.value?.feedback)
    }
}

/// A page pushed over the session: one exercise in full, by its item id.
nonisolated enum LiftSessionPage: Hashable, Identifiable, Sendable {
    case exercise(String)

    var id: String {
        switch self {
        case .exercise(let id): "exercise-\(id)"
        }
    }
}

extension LiftSessionDetail {
    /// The App API path of one session (lift/APP-API.md, "Session").
    static func path(_ sessionID: String) -> String {
        LiftLinks.sessionPath(sessionID)
    }
}
