import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The trends: a 30 | 90 day switch, then one row per metric in one card: its label, latest value and normal range on
/// the left, its chart with the normal band on the right (stacked at accessibility sizes).
struct TodayTrendsView: View {
    let trends: HealthTrends
    let range: HealthRange
    let onRange: (HealthRange) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            SegmentedPicker(
                "Trends window",
                selection: .action(range, onRange),
                options: [
                    ChoiceOption(HealthRange.days30, title: "30 days"),
                    ChoiceOption(HealthRange.days90, title: "90 days"),
                ]
            )
            if trends.items.isEmpty {
                SectionEmptyCard("No trends yet", systemImage: "chart.xyaxis.line")
            } else {
                VStack(spacing: 0) {
                    ForEach(trends.items) { trend in
                        TodayTrendRow(trend: trend)
                        if trend.id != trends.items.last?.id { Separator() }
                    }
                }
                .koboCard(padding: 0)
            }
        }
    }
}

/// One metric: what it is and where it is now, beside its chart.
private struct TodayTrendRow: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.calendar) private var calendar
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .body) private var labelWidth = Size.thumbnail * 2
    let trend: HealthTrend

    var body: some View {
        let layout =
            typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.sm))
            : AnyLayout(HStackLayout(alignment: .center, spacing: Space.md))
        layout {
            summary
                .frame(width: typeSize.isAccessibilitySize ? nil : labelWidth, alignment: .leading)
            TodayTrendChart(scale: TodayTrendScale(trend, calendar: calendar), trend: trend)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, Space.cardInset)
        .padding(.vertical, Space.md)
        .accessibilityElement(children: .combine)
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            Text(verbatim: trend.label)
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            HStack(alignment: .firstTextBaseline, spacing: Space.xxs) {
                if trend.isOff {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.danger.ink)
                        .accessibilityLabel(Text("Outside your normal"))
                }
                Text(verbatim: trend.latestText ?? "–")
                    .font(theme.font(.headline).monospacedDigit())
                    .foregroundStyle(trend.isOff ? theme.palette.danger.ink : theme.palette.textPrimary)
                if let unit = trend.unit, !unit.isEmpty {
                    Text(verbatim: unit)
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                        .lineLimit(1)
                }
            }
            if let foot = trend.normalText ?? trend.compareText ?? trend.recordedText {
                Text(verbatim: foot)
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
