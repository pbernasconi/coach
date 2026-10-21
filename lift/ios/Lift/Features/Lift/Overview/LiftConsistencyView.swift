import KoboComponents
import KoboTokens
import SwiftUI

/// 16 weeks of training: three stats, the days as a heatmap of hard sets (the server's levels), and sessions per week
/// against the target. Every number and label comes from the server.
struct LiftConsistencyView: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.calendar) private var calendar
    let consistency: LiftConsistency

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            LiftCaption(text: consistency.caption)
            HStack(spacing: Space.sm) {
                ForEach(consistency.stats) { stat in
                    StatTile(verbatim: stat.label, value: stat.value)
                }
            }
            if let today = today {
                KoboHeatmap(
                    days: heatmapDays,
                    weeks: max(consistency.heatmap.count, 1),
                    end: today,
                    levels: 4,
                    calendar: calendar,
                    verbatimAccessibilityLabel: String(localized: "Hard sets per day, \(consistency.caption)")
                )
                .koboCard()
            }
            weekBars
        }
    }

    /// Each day's server level (0–4) as its value, so the four shades are the server's.
    private var heatmapDays: [HeatmapDay] {
        consistency.heatmap.flatMap(\.days).compactMap { day in
            LiftDay.date(day.date, calendar: calendar).map { HeatmapDay(date: $0, value: Double(day.level)) }
        }
    }

    private var today: Date? {
        let days = consistency.heatmap.flatMap(\.days)
        let today = days.first(where: \.today) ?? days.last(where: { !$0.future })
        return today.flatMap { LiftDay.date($0.date, calendar: calendar) }
    }

    @ViewBuilder private var weekBars: some View {
        let groups = consistency.weeks.items.compactMap { week in
            LiftDay.date(week.week, calendar: calendar).map {
                BarGroup(x: $0, values: ["sessions": Double(week.sessions)], isMarked: week.met)
            }
        }
        if !groups.isEmpty {
            KoboStackedBarChart(
                groups: groups,
                categories: [BarCategory(id: "sessions", name: String(localized: "Sessions"))],
                reference: ChartReference(y: Double(consistency.weeks.target), label: consistency.weeks.caption),
                markLabel: String(localized: "Target met"),
                height: .compact,
                xText: ChartFormat.date,
                verbatimAccessibilityLabel: String(localized: "Sessions per week, \(consistency.weeks.caption)")
            )
            .koboCard()
        }
    }
}
