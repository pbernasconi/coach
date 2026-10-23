import Charts
import KoboComponents
import KoboTokens
import SwiftUI

/// The weigh-in chart: each reading as a small muted dot, the trend through them as the accent line, and today's reading
/// as a larger dot on top. Weights on the trailing axis, days along the bottom, in the theme's caption font so they grow
/// with Dynamic Type. VoiceOver reads it as one element with a summary.
struct WeighInTrendPlot: View {
    static let trendStroke = StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round)

    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .caption) private var height = WeighInPlotMetrics.height
    let chart: WeighInChart

    var body: some View {
        Chart {
            ForEach(chart.points) { point in
                PointMark(x: .value("Day", point.date), y: .value("Reading", point.kg))
                    .foregroundStyle(theme.palette.textTertiary)
                    .symbolSize(WeighInPlotMetrics.readingArea)
            }
            ForEach(chart.points) { point in
                if let trend = point.trendKg {
                    LineMark(
                        x: .value("Day", point.date),
                        y: .value("Trend", trend),
                        series: .value("Series", "Trend")
                    )
                    .foregroundStyle(theme.palette.accent)
                    .lineStyle(Self.trendStroke)
                    .interpolationMethod(.monotone)
                }
            }
            if let today = chart.points.last {
                PointMark(x: .value("Day", today.date), y: .value("Reading", today.kg))
                    .foregroundStyle(theme.palette.textPrimary)
                    .symbolSize(WeighInPlotMetrics.todayArea)
            }
        }
        .chartYScale(domain: chart.range)
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: dynamicTypeSize.isAccessibilitySize ? 2 : 4)) { _ in
                AxisGridLine().foregroundStyle(theme.palette.separator)
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { _ in
                AxisGridLine().foregroundStyle(theme.palette.separator)
                AxisValueLabel()
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .frame(height: height)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Weight readings and trend"))
        .accessibilityValue(Text(verbatim: chart.accessibilitySummary))
    }
}

/// "● Reading  ▬ Trend" under the chart.
struct WeighInPlotKey: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        HStack(spacing: Space.lg) {
            HStack(spacing: Space.xs) {
                Circle()
                    .fill(theme.palette.textTertiary)
                    .frame(width: Space.sm, height: Space.sm)
                Text("Each reading")
            }
            HStack(spacing: Space.xs) {
                WeighInSwatch()
                Text("Trend")
            }
        }
        .font(theme.font(.caption))
        .foregroundStyle(theme.palette.textSecondary)
        .accessibilityHidden(true)
    }
}

/// The chart's sizes: the plot height and the dot areas (points squared).
enum WeighInPlotMetrics {
    static let height: CGFloat = 180
    static let readingArea: CGFloat = 20
    static let todayArea: CGFloat = 90
}
