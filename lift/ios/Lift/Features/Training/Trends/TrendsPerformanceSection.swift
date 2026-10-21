import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// The four tiles with their 12-week sparklines, the weekly hours by sport, and the weekly table.
struct TrendsPerformanceSection: View {
    let performance: TrendsPerformance
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            if let stale = performance.staleText {
                InlineNotice(verbatim: stale, tone: .warning)
            }
            TileGrid(performance.tiles, id: \.key) { tile in tileView(tile) }
            WeeklyHoursChart(hours: performance.weeklyHours)
            TrendsWeeklyTable(rows: performance.table)
        }
    }

    private func tileView(_ tile: TrendsPerformance.Tile) -> some View {
        // The server's text carries its own arrow ("▼ 7%"): colour only, no error glyph.
        let delta = tile.delta.map { StatDelta.textOnly(verbatim: $0.text, tone: $0.tone.kobo) }
        let color = tile.sport.flatMap(Sport.init(rawValue:))?.color ?? theme.palette.accent
        return StatTile(verbatim: tile.label, value: tile.valueText, delta: delta) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                if let foot = tile.footText {
                    Text(verbatim: foot)
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                }
                if let spark = tile.spark, spark.values.count > 1 {
                    Sparkline(values: spark.values, style: .area, color: color, verbatimAccessibilityLabel: tile.label)
                }
            }
        }
    }
}

/// Hours per week by sport for 12 weeks: the current week lighter, the average as a dashed line, and a dot under
/// weeks with strength days.
struct WeeklyHoursChart: View {
    let hours: TrendsPerformance.WeeklyHours

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader("Weekly hours")
            KoboStackedBarChart(
                groups: groups,
                categories: hours.sports.map {
                    BarCategory(id: $0.id, name: $0.label, color: Sport(rawValue: $0.id)?.color)
                },
                reference: hours.average.map { ChartReference(y: $0, label: hours.averageText ?? "") },
                markLabel: String(localized: "Strength days"),
                xText: { index in hours.weeks.indices.contains(index) ? hours.weeks[index].label : "" },
                yText: { "\(Int($0.rounded())) h" },
                accessibilityLabel: "Hours per week by sport"
            )
        }
    }

    private var groups: [BarGroup<Int>] {
        hours.weeks.enumerated().map { index, week in
            BarGroup(
                x: index,
                values: Dictionary(week.sports.map { ($0.id, $0.hours) }, uniquingKeysWith: +),
                isPartial: week.current,
                isMarked: week.strength > 0
            )
        }
    }
}

/// The 12 weeks as text, newest first.
struct TrendsWeeklyTable: View {
    let rows: [TrendsPerformance.TableRow]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader("Weeks")
            KoboDataTable(
                columns: [
                    DataTableColumn(String(localized: "Week")),
                    DataTableColumn(String(localized: "Hours"), kind: .numeric),
                    DataTableColumn(String(localized: "Run km"), kind: .numeric),
                    DataTableColumn(String(localized: "Pace"), kind: .numeric),
                    DataTableColumn(String(localized: "Ride km"), kind: .numeric),
                    DataTableColumn(String(localized: "Strength"), kind: .numeric),
                    DataTableColumn(String(localized: "TSS"), kind: .numeric),
                    DataTableColumn(String(localized: "Plan"), kind: .numeric),
                ],
                rows: rows.map { row in
                    DataTableRow(
                        id: row.week,
                        cells: [
                            DataTableCell(row.label, emphasized: row.current), DataTableCell(row.hoursText),
                            DataTableCell(row.runKmText), DataTableCell(row.runPaceText), DataTableCell(row.rideKmText),
                            DataTableCell(row.strengthText), DataTableCell(row.tssText), DataTableCell(row.planText),
                        ]
                    )
                }
            )
        }
    }
}
