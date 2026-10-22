import Foundation
import LiftSync

/// Every intent on the activity page, named for what happened (SCR-1).
nonisolated enum ActivityDetailAction: Equatable, Sendable {
    case retryTapped
    /// Pull to refresh: also how the page catches up once Strava's details are in.
    case refreshPulled
    /// The header's arrows: the older or newer activity replaces this page.
    case neighbourTapped(String)
    /// Another activity on the same route.
    case activityTapped(String)
    /// The analysis charts' Distance | Time picker.
    case axisChanged(AnalysisAxis)
    /// The pace bars' Splits | Laps | Smoothed picker.
    case paceModeChanged(String)
    /// The map at the top: a tap, or a pull down past the top of the page.
    case mapExpandTapped
    /// A summary card or a "See all" row: its page of full charts or tables.
    case panelTapped(ActivityPanel)
    case destinationDismissed
    /// "Open Settings" under the not-connected state.
    case connectTapped
    /// The "How did it feel" card.
    case feedback(WorkoutFeedbackAction)
}
