import Foundation

/// Every user intent on the weekly volume screen (SCR-1).
nonisolated enum LiftWeeklyAction: Equatable, Sendable {
    /// Pull to refresh.
    case refreshPulled
    /// "Try again" after a failed load.
    case retryTapped
    /// "Open Settings" under "not connected".
    case connectTapped
}
