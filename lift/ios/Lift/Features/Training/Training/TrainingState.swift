import Foundation
import KoboPatterns

/// The Training tab's two views.
nonisolated enum TrainingSegment: String, CaseIterable, Equatable, Sendable {
    /// Strava activities, newest first.
    case activities
    /// The web's Trends page.
    case trends
}

/// Everything the Training tab renders. Exclusive states are enums (SCR-6).
nonisolated struct TrainingState: Equatable, Sendable {
    var segment: TrainingSegment
    /// The first page of activities (kept on disk, so it shows offline).
    var list = AppResourceState<ActivityListPage>()
    /// The pages loaded after the first, in order.
    var more: [ActivitySummary] = []
    /// The paged list's footer: more pages, loading, failed or the end.
    var footer = LoadMoreFooterModel()
    /// The `before` of the next page; `nil` once the last page is in.
    var nextCursor: String?
    var trends = AppResourceState<TrendsResponse>()
    /// The peaks tables' window: `all`, `d90` or `d28`.
    var peaksWindow = "all"

    /// Every loaded activity, newest first.
    var rows: [ActivitySummary] {
        (list.content.value?.activities ?? []) + more
    }
}
