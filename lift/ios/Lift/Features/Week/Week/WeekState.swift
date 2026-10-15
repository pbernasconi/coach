import Foundation
import LiftCore

/// Everything the Week screen renders. Exclusive states are enums (SCR-6).
nonisolated struct WeekState: Equatable, Sendable {
    /// The weeks the strip pages through, as offsets from this week (0 = this week).
    static let weeks: ClosedRange<Int> = -4...4

    /// The calendar strip; nil until `run()` has read the clock.
    var strip: WeekStrip?
    /// The visible strip page.
    var weekOffset = 0
    /// The selected day's sessions.
    var sessions: Loadable<[SessionSummary]> = .loading
}

/// The calendar strip at the top of the Week screen.
nonisolated struct WeekStrip: Equatable, Sendable {
    var today: Date
    var selected: Date
    /// "Today" or the selected day's long title.
    var title: String
    /// Days in the strip's range that have sessions.
    var days: [WeekDay]
}

/// A day with sessions, as the strip marks it.
nonisolated struct WeekDay: Equatable, Sendable {
    enum Status: Equatable, Sendable {
        /// At least one session still has planned sets.
        case planned
        /// Every session that day is done.
        case done
    }

    var date: Date
    var status: Status
}
