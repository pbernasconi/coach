import Foundation

/// Every intent on the Training tab, named for what happened (SCR-1).
nonisolated enum TrainingAction: Equatable, Sendable {
    /// The Activities | Trends picker.
    case segmentChanged(TrainingSegment)
    /// An activity row, or a peak cell on Trends: opens the activity page.
    case activityTapped(String)
    /// "Load more", "Try again" under the list, or the footer scrolling into view.
    case loadMoreTapped
    /// Pull to refresh: reloads the first page and Trends.
    case refreshPulled
    /// "Try again" on the list's error state.
    case activitiesRetryTapped
    /// "Try again" on the Trends error state.
    case trendsRetryTapped
    /// The peaks tables' All time | 90 days | 28 days picker.
    case peaksWindowChanged(String)
    /// "Open Settings" under the not-connected state.
    case connectTapped
    /// A main lift on Trends: opens that exercise.
    case mainLiftTapped(String)
}
