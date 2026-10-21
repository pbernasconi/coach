import Foundation

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
    /// The map's expand button.
    case mapExpandTapped
    case destinationDismissed
    /// "Open Settings" under the not-connected state.
    case connectTapped
}
