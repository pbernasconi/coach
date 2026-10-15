import Foundation

/// Every user intent on the workout summary, named for what happened (SCR-1).
nonisolated enum WorkoutSummaryAction: Equatable, Sendable {
    /// Done: back to the workout.
    case doneTapped
    /// "Save to Apple Health" on the first summary: asks Health, then saves this workout and later ones.
    case healthAllowTapped
    /// The prompt's close button: saving to Apple Health stays off (Settings turns it on).
    case healthNotNowTapped
}
