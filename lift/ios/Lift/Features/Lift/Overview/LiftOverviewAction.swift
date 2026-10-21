import Foundation

/// Every user intent on the Lift overview, named for what happened (SCR-1).
nonisolated enum LiftOverviewAction: Equatable, Sendable {
    /// The page pulled down: fetches it again.
    case refreshPulled
    /// "Try again" after a failed first load.
    case retryTapped
    /// A session (next up, a day of the week, a session row, a record, a heatmap day), by its `sessionId`.
    case sessionTapped(String)
    /// A main lift or an exercise row, by its `exerciseKey`.
    case exerciseTapped(String)
    /// A coach tip, by its `id`: opens its link, or scrolls to the section it names.
    case tipTapped(String)
    /// "Open Settings" under "not connected": the Settings tab, where Sync connects Lift to the coach.
    case connectTapped
    /// "Weekly volume" under the sessions.
    case weeklyTapped
    /// "Older sessions": shows or hides the logged sessions after the first `shown`.
    case olderSessionsExpandedChanged(Bool)
    /// "All exercises": shows or hides the exercise index.
    case exercisesExpandedChanged(Bool)
}
