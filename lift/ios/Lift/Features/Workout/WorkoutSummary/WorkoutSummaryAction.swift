import Foundation

/// Every user intent on the workout summary, named for what happened (SCR-1).
nonisolated enum WorkoutSummaryAction: Equatable, Sendable {
    /// Done: back to the workout.
    case doneTapped
}
