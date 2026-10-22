import LiftSync

/// Everything the planned workout page renders (SCR-6).
nonisolated struct PlannedWorkoutState: Equatable, Sendable {
    /// `GET /api/app/plan/{id}`, with how fresh it is.
    var workout = AppResourceState<AppPlannedWorkout>()
    var feedback = WorkoutFeedbackEdit()

    /// The card's feedback: the edited copy, else the body's.
    var shownFeedback: WorkoutFeedback? {
        feedback.shown(workout.content.value?.feedback)
    }
}
