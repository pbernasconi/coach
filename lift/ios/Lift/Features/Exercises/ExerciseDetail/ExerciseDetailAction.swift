import Foundation
import LiftCore

/// Every user intent on the exercise detail screen, named for what happened (SCR-1).
nonisolated enum ExerciseDetailAction: Equatable, Sendable {
    /// "Watch technique videos": opens a YouTube search (or the pinned video).
    case videosTapped
    /// "From the exercise library": shows or hides the catalog's steps.
    case libraryStepsExpandedChanged(Bool)
    /// The progress range picker: 3M, 6M, 1Y or All.
    case progressRangeChanged(ProgressRange)
    /// The chart was touched at a day (nil once it is let go).
    case progressSelectionChanged(Date?)
    /// The coach's e1RM chart was touched at a session's day; nil once it is let go (the last touched point stays).
    case serverChartSelectionChanged(Date?)
    /// "All sessions": shows or hides the coach's sessions after the first few.
    case serverSessionsExpandedChanged(Bool)
    /// A session row, a best set or the touched chart point: opens that session.
    case sessionTapped(String)
    /// Pull to refresh: fetches the coach's numbers again.
    case refreshPulled
    /// "Try again" after the coach's numbers failed to load.
    case retryTapped
}
