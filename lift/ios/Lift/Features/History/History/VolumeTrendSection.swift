import Charts
import KoboComponents
import KoboTokens
import SwiftUI

/// Sizes of the 8-week trend.
enum VolumeTrendMetrics {
    /// The plot's height at the default text size; it grows with Dynamic Type.
    static let plotHeight: CGFloat = 132
}

/// "Last 8 weeks": every week's hard sets as a column, the week the bars above show in the accent. Touching a column
/// shows that week above. VoiceOver reads the weeks as one summary; the arrows above step through them.
struct VolumeTrendSection: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .caption) private var height = VolumeTrendMetrics.plotHeight
    let progress: VolumeProgress
    let send: (HistoryAction) -> Void

    var body: some View {
        DetailSection("Hard sets per week") {
            Chart(progress.trend) { bar in
                BarMark(
                    x: .value("Week", bar.date, unit: .weekOfYear),
                    y: .value("Hard sets", bar.sets)
                )
                .foregroundStyle(bar.isSelected ? theme.palette.accent : theme.palette.accentSoft)
                .cornerRadius(Radius.xs)
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .weekOfYear, count: dynamicTypeSize.isAccessibilitySize ? 4 : 2)) { _ in
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
            .chartXSelection(value: Binding<Date?>.action(nil) { send(.volumeTrendSelectionChanged($0)) })
            .frame(height: height)
            .koboAnimation(.state, value: progress.trend)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text("Hard sets per week, last 8 weeks"))
            .accessibilityValue(Text(verbatim: progress.trendSummary))
        }
    }
}
