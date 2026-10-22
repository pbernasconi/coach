import LiftSync

/// Everything the planned workout page renders (SCR-6).
nonisolated struct PlannedWorkoutState: Equatable, Sendable {
    /// `GET /api/app/plan/{id}`, with how fresh it is.
    var workout = AppResourceState<AppPlannedWorkout>()
}
