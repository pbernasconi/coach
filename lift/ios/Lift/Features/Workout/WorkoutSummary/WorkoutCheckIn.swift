import Foundation
import LiftSync

/// The check-in after a workout finishes in Lift: two steps, how hard it was (RPE 1–10 on a dial) and how it felt
/// (five faces), then one save to the coach (`PUT api/app/feedback`, item `lift:<session id>`).
nonisolated struct WorkoutCheckIn: Equatable, Sendable {
    enum Step: Equatable, Sendable {
        case effort
        case feel
    }

    var step = Step.effort
    var feedback: WorkoutFeedback

    /// Save is offered once something is logged.
    var canSave: Bool { feedback.rpe != nil || feedback.feel != nil }
}

/// Every intent on the check-in sheet.
nonisolated enum WorkoutCheckInAction: Equatable, Sendable {
    /// The dial moved to an effort, 1 to 10.
    case effortChanged(Int)
    /// A face, 1 (very weak) to 5 (very strong); a second tap clears it.
    case feelTapped(Int)
    case nextTapped
    case backTapped
    case saveTapped
    /// Closes the sheet without saving.
    case skipTapped
}

/// When a summary asks: the workout finished in Lift a moment ago (a summary opened later never asks).
nonisolated enum WorkoutCheckInWindow {
    static let seconds: TimeInterval = 15 * 60
}
