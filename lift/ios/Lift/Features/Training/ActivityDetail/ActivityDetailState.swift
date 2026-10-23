import Foundation
import KoboPatterns
import LiftSync

/// The analysis charts' shared x axis.
nonisolated enum AnalysisAxis: String, CaseIterable, Equatable, Sendable {
    case distance, time
}

/// A page under the activity page, opened from a summary card or a "See all" row: the full charts and tables.
nonisolated enum ActivityPanel: String, Hashable, Identifiable, Sendable {
    /// Every stream on one axis, with the Distance | Time picker.
    case charts
    /// Pace or speed: the bars, the distribution and the splits.
    case pace
    case heartRate
    case power
    case splits
    case laps
    case bestEfforts
    case segments
    case sameRoute
    /// Every stat not in the grid.
    case stats

    var id: String { rawValue }
}

/// Everything the activity page renders. Exclusive states are enums (SCR-6).
nonisolated struct ActivityDetailState: Equatable, Sendable {
    /// What is shown over the page.
    enum Destination: Equatable, Sendable {
        /// A page of full charts or tables.
        case panel(ActivityPanel)
    }

    /// The open panel, if one is open.
    var panel: ActivityPanel? {
        if case .panel(let panel) = destination { panel } else { nil }
    }

    /// The id the page was opened with (a Strava id, or `latest`).
    var activityID: String
    var detail = AppResourceState<ActivityDetail>()
    var axis: AnalysisAxis = .distance
    /// The pace bars' mode key (`splits`, `laps`, `smoothed`); the first the server sends when `nil`.
    var paceMode: String?
    var destination: Destination?
    var feedback = WorkoutFeedbackEdit()

    /// The card's feedback: the edited copy, else the body's.
    var shownFeedback: WorkoutFeedback? {
        feedback.shown(detail.content.value?.feedback)
    }
}
