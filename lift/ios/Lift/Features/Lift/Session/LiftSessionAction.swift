import Foundation
import LiftSync

/// Every user intent on the read-only session screen, named for what happened (SCR-1).
nonisolated enum LiftSessionAction: Equatable, Sendable {
    /// "Try again" after a failed load with nothing kept.
    case retryTapped
    case refreshPulled
    /// "Open Settings" under "not connected".
    case connectTapped
    /// "Back" under "This workout was deleted".
    case backTapped
    /// The older or newer session in the bar's menu: replaces this page, so Back still leads where it was opened from.
    case olderTapped
    case newerTapped
    /// An exercise row: its page with every set, last time, the trend and how to do it.
    case exerciseOpened(exerciseID: String)
    /// The exercise page went away (Back or a swipe).
    case pageClosed
    /// "Last time" on an exercise page: the earlier session, by id.
    case lastTimeTapped(sessionID: String)
    /// The best e1RM and its trend on an exercise page: the exercise's history, by key.
    case exerciseTapped(exerciseKey: String)
    /// The heart-rate card: the watch's activity page.
    case watchTapped
    /// An exercise row appeared: load its catalog picture once.
    case mediaNeeded(exerciseID: String)
    /// "How to" on an exercise page was opened or closed.
    case stepsExpandedChanged(exerciseID: String, isExpanded: Bool)
    /// The "How did it feel" card.
    case feedback(WorkoutFeedbackAction)
}
