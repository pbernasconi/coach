import Foundation

/// Everything the weekly volume screen renders (SCR-6).
nonisolated struct LiftWeeklyState: Equatable, Sendable {
    /// `GET /api/app/lift/weekly`, with how fresh it is.
    var weekly = AppResourceState<LiftWeekly>()
}
