/// Every user intent on the planned workout page (SCR-1).
nonisolated enum PlannedWorkoutAction: Equatable, Sendable {
    /// Pull to refresh.
    case refreshPulled
    /// "Try again" after a failed load.
    case retryTapped
    /// "Open Settings" under "not connected".
    case connectTapped
    /// "Open activity": the Strava activity that completed the workout.
    case activityTapped(String)
    /// "Open session": the Lift session the workout plans.
    case sessionTapped(String)
    /// The "How did it feel" card.
    case feedback(WorkoutFeedbackAction)
}
