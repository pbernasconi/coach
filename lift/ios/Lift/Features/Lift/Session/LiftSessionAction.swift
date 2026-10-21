import Foundation

/// Every user intent on the read-only session screen, named for what happened (SCR-1).
nonisolated enum LiftSessionAction: Equatable, Sendable {
    /// "Try again" after a failed load with nothing kept.
    case retryTapped
    case refreshPulled
    /// The older or newer session: replaces this page, so Back still leads where the session was opened from.
    case olderTapped
    case newerTapped
    /// "Last time" on an exercise card: the earlier session, by id.
    case lastTimeTapped(sessionID: String)
    /// The best e1RM and its trend on an exercise card: the exercise's page, by key.
    case exerciseTapped(exerciseKey: String)
    /// An exercise card appeared: load its catalog picture once.
    case mediaNeeded(exerciseID: String)
    /// "How to" on an exercise card was opened or closed.
    case stepsExpandedChanged(exerciseID: String, isExpanded: Bool)
}
