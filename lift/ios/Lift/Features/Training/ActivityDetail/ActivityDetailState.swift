import Foundation
import KoboPatterns

/// The analysis charts' shared x axis.
nonisolated enum AnalysisAxis: String, CaseIterable, Equatable, Sendable {
    case distance, time
}

/// Everything the activity page renders. Exclusive states are enums (SCR-6).
nonisolated struct ActivityDetailState: Equatable, Sendable {
    /// What is shown over the page.
    enum Destination: Equatable, Sendable {
        /// The route on a large map that pans and zooms.
        case map
    }

    /// The id the page was opened with (a Strava id, or `latest`).
    var activityID: String
    var detail = AppResourceState<ActivityDetail>()
    var axis: AnalysisAxis = .distance
    /// The pace bars' mode key (`splits`, `laps`, `smoothed`); the first the server sends when `nil`.
    var paceMode: String?
    var destination: Destination?
}
