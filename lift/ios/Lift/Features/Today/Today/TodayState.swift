import Foundation
import LiftSync

/// Everything the Today screen renders: the coach's Today page (`/api/app/today`) and the open sheet. Exclusive states
/// are enums (SCR-6).
nonisolated struct TodayState: Equatable, Sendable {
    var today = AppResourceState<AppToday>()
    var destination: Destination?
    /// A section to scroll to once the page shows (screenshots); nil for the top.
    var anchor: TodayAnchor?

    enum Destination: Equatable, Sendable {
        /// The read-only detail sheet of one of today's planned workouts (from the kept week plan).
        case planItem(WeekPlanItem)
    }

    var planItemTarget: WeekPlanItem? {
        guard case .planItem(let item) = destination else { return nil }
        return item
    }
}

/// A section of Today the page can start scrolled to.
nonisolated enum TodayAnchor: String, Equatable, Sendable {
    case fitness
    /// The end of the page, under the last section.
    case end
}
