import Foundation
import LiftCore

/// Everything the History screen renders. Exclusive states are enums (SCR-6).
nonisolated struct HistoryState: Equatable, Sendable {
    /// How many weeks back the history goes, this week included.
    static let weekCount = 8

    /// Sessions or Progress.
    var segment: HistorySegment = .sessions
    /// Past weeks with sessions, newest first.
    var weeks: Loadable<[HistoryWeek]> = .loading
    /// Hard sets per muscle and the 8-week trend; `.empty` when no hard set was logged in those weeks.
    var volume: Loadable<VolumeProgress> = .loading
    /// The exercises behind a tapped muscle, shown in a sheet.
    var muscleDetail: MuscleDetail?
}

/// One week of past sessions.
nonisolated struct HistoryWeek: Equatable, Sendable, Identifiable {
    /// The first day of the week.
    var id: LocalDay
    /// "Week of 12 Oct".
    var title: String
    /// Newest first.
    var sessions: [HistorySession]
}

/// A past session with its day label.
nonisolated struct HistorySession: Equatable, Sendable, Identifiable {
    var summary: SessionSummary
    /// "Tue 13 Oct".
    var dayTitle: String

    var id: UUID { summary.id }
}
