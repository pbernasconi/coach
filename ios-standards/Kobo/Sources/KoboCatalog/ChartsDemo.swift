import Foundation
import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Charts section.
struct ChartsDemo: View {
    let component: CatalogComponent
    @Environment(\.koboTheme) private var theme
    @State private var tapped: String?

    var body: some View {
        switch component {
        case .sparkline:
            HStack(spacing: Space.sm) {
                StatTile(label: "Distance", value: "42.1", unit: "km") {
                    Sparkline(values: [20, 28, 25, 31, 36, 42], accessibilityLabel: "Distance trend")
                }
                StatTile(label: "Minutes", value: "35") {
                    Sparkline(
                        values: [42, 40, 44, 39, 37, 35],
                        style: .area,
                        reference: 40,
                        accessibilityLabel: "Trend"
                    )
                }
            }
        case .lineChart: lineChart
        case .linePanels: linePanels
        case .stackedBarChart:
            KoboStackedBarChart(
                groups: ChartSamples.weeks,
                categories: ChartSamples.categories,
                reference: ChartReference(y: 6.1, label: "Avg 6.1 h"),
                markLabel: "Long outing",
                xText: ChartFormat.date,
                yText: { "\(Int($0)) h" },
                accessibilityLabel: "Hours per week"
            )
        case .histogram:
            KoboHistogram(
                values: ChartSamples.minutes,
                binWidth: 10,
                averageLabel: "Avg",
                xText: { "\(Int($0))′" },
                accessibilityLabel: "Session length"
            )
        case .variableWidthBarChart:
            VariableWidthBarChart(
                bars: ChartSamples.splits,
                yDirection: .down,
                xText: { "\(Int($0)) km" },
                accessibilityLabel: "Minutes per km"
            )
        case .bandBar:
            VStack(spacing: Space.md) {
                BandBar(value: 12, scaleMax: 25, band: 10...20, tick: 9, accessibilityLabel: "Reading")
                BandBar(value: 4, scaleMax: 25, band: 10...20, tick: 8, accessibilityLabel: "Writing")
            }
        case .zoneBars: ZoneBars(items: ChartSamples.zones)
        case .heatmap:
            KoboHeatmap(
                days: ChartSamples.activeDays,
                weeks: 16,
                end: ChartSamples.today,
                accessibilityLabel: "Activity"
            )
        case .dataTable: dataTable
        case .routeMap: KoboRouteMap(points: ChartSamples.loop, accessibilityLabel: "Route")
        default: EmptyView()
        }
    }

    private var lineChart: some View {
        VStack(spacing: Space.section) {
            KoboLineChart(
                series: [
                    ChartSeries(
                        id: "score",
                        name: "Score",
                        points: ChartSamples.daily(70, base: 40, swing: 8),
                        fillsArea: true
                    ),
                    ChartSeries(
                        id: "plan",
                        name: "Plan",
                        points: ChartSamples.daily(90, base: 41, swing: 6).suffix(21),
                        stroke: .dashed
                    ),
                ],
                bands: [ChartBand(30...45, label: "Steady", tone: .success)],
                markers: [ChartMarker(x: ChartSamples.today, label: "Today")],
                xText: ChartFormat.date,
                accessibilityLabel: "Score"
            )
            KoboLineChart(
                series: [ChartSeries(id: "best", name: "Best", points: ChartSamples.curve, showsPoints: true)],
                references: [ChartReference(y: 240, label: "Threshold")],
                xText: { $0 < 60 ? "\(Int($0))s" : "\(Int($0 / 60))m" },
                accessibilityLabel: "Best output by duration"
            )
            .logarithmicX(ticks: [5, 30, 60, 300, 1_200, 3_600])
        }
    }

    private var linePanels: some View {
        KoboLinePanels(
            panels: [
                LinePanel(
                    id: "speed",
                    title: "Speed",
                    series: [
                        ChartSeries(id: "s", name: "Speed", points: ChartSamples.stream(base: 24, swing: 4, speed: 0.9))
                    ],
                    yText: { "\(Int($0)) km/h" }
                ),
                LinePanel(
                    id: "height",
                    title: "Height",
                    series: [
                        ChartSeries(
                            id: "h",
                            name: "Height",
                            points: ChartSamples.stream(base: 320, swing: 40, speed: 0.4)
                        )
                    ],
                    yText: { "\(Int($0)) m" }
                ),
            ],
            xText: { "\(Int($0)) km" }
        )
    }

    private var dataTable: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            KoboDataTable(columns: ChartSamples.tableColumns, rows: ChartSamples.tableRows) { tapped = $0 }
            if let tapped {
                Text(verbatim: "Tapped row \(tapped)")
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }
}
