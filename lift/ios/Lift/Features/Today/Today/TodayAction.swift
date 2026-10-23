import Foundation

/// Every user intent on the Today screen, named for what happened (SCR-1).
nonisolated enum TodayAction: Equatable, Sendable {
    /// The page pulled down: fetches today's plan and the health page again.
    case refreshPulled
    /// "Try again" after a failed first load.
    case retryTapped
    /// One of today's planned workouts, by its plan id: its Lift session, or its detail sheet.
    case lineItemTapped(String)
    /// "Open activity" in a planned workout's sheet: the matched Strava activity.
    case planActivityTapped(String)
    /// The trends' window changed (30 or 90 days): fetches the health page for it.
    case trendRangeChanged(HealthRange)
    /// "Open Settings" under "Connect this iPhone to Coach": the Settings tab, where Sync is.
    case connectTapped
    case destinationDismissed
}
