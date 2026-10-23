import Foundation
import LiftSync

/// Everything the Today screen renders: today's plan (`/api/app/today`), the health page (`/api/app/health`) and the
/// open sheet. Exclusive states are enums (SCR-6).
nonisolated struct TodayState: Equatable, Sendable {
    /// Today's date line and planned workouts.
    var today = AppResourceState<AppToday>()
    /// Readiness, vitals, trends, body and labs: the page's main content.
    var health = AppResourceState<AppHealth>()
    /// The trends' window.
    var range = HealthRange.days30
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

/// The two windows of the health trends, as on the web.
nonisolated enum HealthRange: Int, CaseIterable, Equatable, Sendable {
    case days30 = 30
    case days90 = 90

    /// The health page's query for this window.
    var query: [URLQueryItem] { [URLQueryItem(name: "days", value: String(rawValue))] }
}

/// A section of Today the page can start scrolled to.
nonisolated enum TodayAnchor: String, Equatable, Sendable {
    case trends
    /// The end of the page, under the last section.
    case end
}
