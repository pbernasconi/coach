import LiftSync

/// Every user intent on the weigh-in screen (SCR-1).
nonisolated enum WeighInAction: Equatable, Sendable {
    /// Pull to refresh.
    case refreshPulled
    /// "Try again" after a failed load.
    case retryTapped
    /// "Open Settings" under "not connected".
    case connectTapped
    /// The earlier or the later weigh-in row.
    case dayTapped(PlainDay)
}
