import Foundation
import LiftCore

/// The two views of the History tab: past sessions by week, or training volume.
nonisolated enum HistorySegment: String, CaseIterable, Equatable, Sendable {
    case sessions
    case progress
}

/// Hard sets per muscle for one week against the 10–20 band, and total hard sets for each of the last 8 weeks.
nonisolated struct VolumeProgress: Equatable, Sendable {
    /// The week the muscle rows show: this week until another is picked.
    var week: VolumeWeek
    /// The last `HistoryState.weekCount` weeks, oldest first.
    var trend: [VolumeTrendBar]
    /// The weeks either side of `week`, for the arrows; nil at either end of the trend.
    var previousWeek: LocalDay?
    var nextWeek: LocalDay?
    /// The top of the bars' scale: at least a little past the band, so the band always shows.
    var scaleMax: Double
    /// Every trend week's hard sets, for VoiceOver.
    var trendSummary: String
}

/// One week's hard sets per muscle.
nonisolated struct VolumeWeek: Equatable, Sendable, Identifiable {
    /// The week's first day.
    var id: LocalDay
    /// "This week", "Last week" or "Week of Oct 4".
    var title: String
    /// "24 hard sets".
    var total: String
    /// Every muscle, in a fixed order so weeks compare at a glance.
    var muscles: [VolumeMuscleRow]
}

/// One muscle's bar.
nonisolated struct VolumeMuscleRow: Equatable, Sendable, Identifiable {
    var id: Muscle
    /// "Quads".
    var name: String
    /// Hard sets, secondary muscles counting a half each.
    var sets: Double
    /// "7.5".
    var value: String
    var status: VolumeStatus
    /// "7.5 hard sets, below 10 to 20" for VoiceOver.
    var accessibilityValue: String
}

/// One week in the 8-week trend.
nonisolated struct VolumeTrendBar: Equatable, Sendable, Identifiable {
    /// The week's first day.
    var id: LocalDay
    /// The start of the week's first day, for the chart's x axis.
    var date: Date
    /// Every hard set in the week.
    var sets: Int
    var isSelected: Bool
}

/// The sheet behind a tapped muscle: the exercises that added to its sets in the shown week.
nonisolated struct MuscleDetail: Equatable, Sendable, Identifiable {
    var id: Muscle
    /// "Quads".
    var title: String
    /// "Week of Oct 4 · 7.5 hard sets".
    var subtitle: String
    /// Most sets first; empty when nothing worked the muscle that week.
    var rows: [MuscleDetailRow]
}

/// One exercise in a muscle's sheet.
nonisolated struct MuscleDetailRow: Equatable, Sendable, Identifiable {
    /// The library exercise.
    var id: UUID
    /// "Back squat".
    var name: String
    /// "Primary · 3 sets" or "Secondary · 4 sets at half credit".
    var detail: String
    /// "3" or "2".
    var value: String
}
