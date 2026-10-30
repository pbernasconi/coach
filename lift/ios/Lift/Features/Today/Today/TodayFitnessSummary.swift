import Foundation
import LiftCore
import LiftSync

/// The Today hero's numbers and chart, from `/api/app/today`'s fitness section: fitness (CTL), form (TSB) and fatigue
/// (ATL) on the last actual day, how far fitness moved in a week, and the last six weeks plus the projection as dates.
nonisolated struct TodayFitnessSummary: Equatable, Sendable {
    nonisolated struct Point: Equatable, Sendable {
        let date: Date
        let ctl: Double
        let atl: Double
        let tsb: Double
        let projected: Bool
    }

    /// The days the chart shows before today's.
    static let windowDays = 42

    let fitness: Int
    let form: Int
    let fatigue: Int
    /// The form band's name ("Neutral"), when the server sends one.
    let zone: String?
    /// Fitness now minus fitness seven days before; nil without that day.
    let fitnessChange: Int?
    /// The last six weeks of actual days, then the projected ones.
    let points: [Point]
    /// The last actual day, where the chart marks today.
    let today: Date?

    /// Nil when there is no actual day yet.
    init?(_ fitness: TodayFitness, calendar: Calendar) {
        guard let now = fitness.now else { return nil }
        self.fitness = Int(now.ctl.rounded())
        form = Int(now.tsb.rounded())
        fatigue = Int(now.atl.rounded())
        zone = now.zone
        let weekAgo = now.date.day.adding(days: -7)
        fitnessChange = fitness.days.first { !$0.projected && $0.date.day == weekAgo }
            .map { Int(now.ctl.rounded()) - Int($0.ctl.rounded()) }
        let first = now.date.day.adding(days: -Self.windowDays)
        points = fitness.days.compactMap { day in
            guard day.date.day >= first, let date = day.date.day.startDate(in: calendar) else { return nil }
            return Point(date: date, ctl: day.ctl, atl: day.atl, tsb: day.tsb, projected: day.projected)
        }
        today = now.date.day.startDate(in: calendar)
    }

    /// "19", or "−4" with a true minus sign.
    static func text(_ value: Int) -> String {
        value < 0 ? "\u{2212}\(-value)" : "\(value)"
    }

    /// "+3 this week", "−2 this week" or "Same as last week"; nil without the week-ago day.
    var changeText: String? {
        guard let change = fitnessChange else { return nil }
        if change == 0 { return String(localized: "Same as last week") }
        let signed = change > 0 ? "+\(change)" : Self.text(change)
        return String(localized: "\(signed) this week")
    }
}
