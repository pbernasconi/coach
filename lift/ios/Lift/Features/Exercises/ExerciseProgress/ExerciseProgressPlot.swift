import Charts
import KoboComponents
import KoboTokens
import SwiftUI

/// The progress chart: estimated one-rep max per session as a solid line with dots in the accent ink, the heaviest set
/// as a dashed secondary line, and a rule at the touched session. Weights on the trailing axis, days along the bottom,
/// both in the theme's caption font so they grow with Dynamic Type. VoiceOver reads it as one element with a summary.
struct ExerciseProgressPlot: View {
    /// The heaviest-set line, also drawn by the legend.
    static let heaviestStroke = StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [3, 4])
    /// The estimate line.
    static let estimateStroke = StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round)
    /// The area of a session's dot, and of the touched one.
    static let pointArea: CGFloat = 24
    static let selectedPointArea: CGFloat = 96

    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .caption) private var height = ExerciseProgressMetrics.plotHeight
    let chart: ExerciseProgressChart
    let selectionChanged: (Date?) -> Void

    var body: some View {
        Chart {
            ForEach(chart.points) { point in
                if let heaviest = point.heaviest {
                    LineMark(
                        x: .value("Day", point.date),
                        y: .value("Weight", heaviest),
                        series: .value("Series", "Heaviest set")
                    )
                    .foregroundStyle(theme.palette.textTertiary)
                    .lineStyle(Self.heaviestStroke)
                }
            }
            ForEach(chart.points) { point in
                if let estimate = point.estimate {
                    LineMark(
                        x: .value("Day", point.date),
                        y: .value("Weight", estimate),
                        series: .value("Series", "Est. 1RM")
                    )
                    .foregroundStyle(theme.palette.accentText)
                    .lineStyle(Self.estimateStroke)
                    PointMark(x: .value("Day", point.date), y: .value("Weight", estimate))
                        .foregroundStyle(theme.palette.accentText)
                        .symbolSize(Self.pointArea)
                }
            }
            if let selected = chart.selected {
                RuleMark(x: .value("Day", selected.date))
                    .foregroundStyle(theme.palette.textTertiary)
                    .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2))
                if let value = selected.estimate ?? selected.heaviest {
                    PointMark(x: .value("Day", selected.date), y: .value("Weight", value))
                        .foregroundStyle(theme.palette.accentText)
                        .symbolSize(Self.selectedPointArea)
                }
            }
        }
        .chartXScale(domain: chart.domain)
        .chartYScale(domain: .automatic(includesZero: false))
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
        .chartXSelection(value: .action(chart.selected?.date) { selectionChanged($0) })
        .frame(height: height)
        .koboAnimation(.state, value: chart.points)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Estimated 1RM and heaviest set per session"))
        .accessibilityValue(Text(verbatim: chart.accessibilitySummary))
    }
}
