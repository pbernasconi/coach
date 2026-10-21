import Foundation

/// Shows the workout and its rest outside the app (Lock Screen, Dynamic Island). The Workout ViewModel drives it; the
/// composition root picks the live `WorkoutActivityCenter`, and tests pass a recording fake (SCR-3).
protocol RestActivityController: AnyObject {
    /// The Workout screen shows `sessionID`. Its Live Activity starts at the first logged set and stays until the workout
    /// is finished or discarded, also after the screen is left.
    func showWorkout(_ sessionID: UUID)
    /// Picks up a workout Live Activity left running by an earlier launch, or ends it when its workout is over.
    func resume()
    /// Shows a new rest after a logged set.
    func start(_ attributes: RestActivityAttributes, state: RestActivityAttributes.ContentState)
    /// Moves the end of the rest on screen, after +30s.
    func update(endsAt: Date, totalSeconds: Int)
    /// Ends the rest; the workout stays on the Lock Screen.
    func end()
    /// The rest as it stands outside the app: the Live Activity's +30s and Skip change it while Lift is in the
    /// background, and its Done starts a new one. Nil when there is none (it was skipped there, or ended).
    func currentRest() -> RestSnapshot?
}
