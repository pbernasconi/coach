import Foundation
import LiftCore

/// The progress chart of one exercise, as the exercise and catalog detail screens render it.
nonisolated struct ExerciseProgressState: Equatable, Sendable {
    /// How far back the chart looks.
    var range: ProgressRange = .threeMonths
    /// `.loading` until the history is read, `.empty` when no session can be charted (the section is hidden then).
    var chart: Loadable<ExerciseProgressChart> = .loading
}

/// The chart for the chosen range, ready to draw.
nonisolated struct ExerciseProgressChart: Equatable, Sendable {
    /// The sessions in the range, oldest first. Empty when the range has none.
    var points: [ProgressChartPoint]
    /// The x axis: the range's first day (or the first session, for All) through today.
    var domain: ClosedRange<Date>
    /// The best and the change, or the selected session while a point is selected.
    var headline: ProgressHeadline
    /// The selected session, while the chart is touched.
    var selectedID: UUID?
    /// "No sessions in the last 3 months", when `points` is empty.
    var emptyMessage: String?
    /// What VoiceOver reads for the whole chart: the sessions, the best and the change, as numbers.
    var accessibilitySummary: String

    /// The point of `selectedID`.
    var selected: ProgressChartPoint? {
        points.first { $0.id == selectedID }
    }
}

/// One session on the chart, in the chart's unit.
nonisolated struct ProgressChartPoint: Equatable, Sendable, Identifiable {
    /// The session id.
    var id: UUID
    /// The start of the session's day.
    var date: Date
    /// The best estimated one-rep max; nil when it cannot be estimated.
    var estimate: Double?
    /// The heaviest working set; nil without load.
    var heaviest: Double?
}

/// The numbers above the chart: a label over a value, with a detail line.
nonisolated struct ProgressHeadline: Equatable, Sendable {
    /// "Best est. 1RM", or "Thu, Oct 9 · Est. 1RM" for a selected session.
    var label: String
    /// "121 kg".
    var value: String
    /// "+6.5 kg since Jul 14", or "Top set 5 @ 85 kg" for a selected session; nil when there is nothing to add.
    var detail: String?
}
