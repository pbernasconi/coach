import Charts
import KoboComponents
import KoboTokens
import SwiftUI

/// The top of Today, as TrainingPeaks opens: fitness, form and fatigue in big coloured numbers, then the last six
/// weeks of the three lines and the dashed projection. The colours are the Coach widget's (`HomeWidgetColors`).
struct TodayFitnessHero: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var scheme
    let summary: TodayFitnessSummary

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            HStack(alignment: .top, spacing: Space.sm) {
                stat(summary.fitness, "Fitness", HomeWidgetColors.fitness(scheme), note: summary.changeText)
                stat(summary.form, "Form", HomeWidgetColors.form(scheme), note: summary.zone)
                stat(summary.fatigue, "Fatigue", HomeWidgetColors.fatigue(scheme), note: nil)
            }
            if summary.points.count > 1 {
                TodayFitnessChart(summary: summary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .koboCard()
    }

    private func stat(_ value: Int, _ label: LocalizedStringKey, _ color: Color, note: String?) -> some View {
        VStack(spacing: Space.xxs) {
            Text(verbatim: TodayFitnessSummary.text(value))
                .font(theme.font(.display))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(color)
            Text(verbatim: note ?? " ")
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .accessibilityHidden(note == nil)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

/// Fitness as a soft area under its line, fatigue and form as lines, the projection dashed, today as a faint rule.
struct TodayFitnessChart: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var scheme
    @ScaledMetric(relativeTo: .body) private var height: CGFloat = 150
    let summary: TodayFitnessSummary

    var body: some View {
        Chart {
            ForEach(actual, id: \.date) { point in
                AreaMark(x: .value("Day", point.date), y: .value("Fitness", point.ctl))
                    .foregroundStyle(HomeWidgetColors.fitness(scheme).opacity(0.14))
                    .interpolationMethod(.monotone)
            }
            line(\.ctl, "Fitness", HomeWidgetColors.fitness(scheme), width: 2.5)
            line(\.atl, "Fatigue", HomeWidgetColors.fatigue(scheme), width: 1.5)
            line(\.tsb, "Form", HomeWidgetColors.form(scheme), width: 1.5)
            RuleMark(y: .value("Zero", 0))
                .foregroundStyle(theme.palette.separator)
                .lineStyle(StrokeStyle(lineWidth: Size.hairline))
            if let today = summary.today, !projected.isEmpty {
                RuleMark(x: .value("Today", today))
                    .foregroundStyle(theme.palette.textTertiary)
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [Space.xxs, Space.xxs]))
            }
        }
        .chartLegend(.hidden)
        .chartYScale(domain: yDomain)
        .chartXAxis {
            AxisMarks(values: .stride(by: .weekOfYear, count: 2)) { _ in
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textTertiary)
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { _ in
                AxisGridLine().foregroundStyle(theme.palette.separator)
                AxisValueLabel()
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textTertiary)
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }

    /// From the lowest to the highest value shown (zero always in), a little padded, so the lines fill the height.
    private var yDomain: ClosedRange<Double> {
        let values = summary.points.flatMap { [$0.ctl, $0.atl, $0.tsb] }
        let low = min(values.min() ?? 0, 0)
        let high = max(values.max() ?? 1, 1)
        let pad = (high - low) * 0.08
        return (low - pad)...(high + pad)
    }

    /// The days up to today.
    private var actual: [TodayFitnessSummary.Point] { summary.points.filter { !$0.projected } }

    /// Today, then the projected days, so the dashed line starts where the solid one ends.
    private var projected: [TodayFitnessSummary.Point] {
        let ahead = summary.points.filter(\.projected)
        guard !ahead.isEmpty, let last = actual.last else { return [] }
        return [last] + ahead
    }

    /// One metric: a solid series through today and a dashed one after it.
    @ChartContentBuilder
    private func line(
        _ value: KeyPath<TodayFitnessSummary.Point, Double>,
        _ name: String,
        _ color: Color,
        width: CGFloat
    ) -> some ChartContent {
        ForEach(actual, id: \.date) { point in
            LineMark(
                x: .value("Day", point.date),
                y: .value(name, point[keyPath: value]),
                series: .value("Series", name)
            )
            .foregroundStyle(color)
            .lineStyle(StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
            .interpolationMethod(.monotone)
        }
        ForEach(projected, id: \.date) { point in
            LineMark(
                x: .value("Day", point.date),
                y: .value(name, point[keyPath: value]),
                series: .value("Series", name + " projected")
            )
            .foregroundStyle(color.opacity(0.7))
            .lineStyle(StrokeStyle(lineWidth: width, lineCap: .round, dash: [Space.xs, Space.xs]))
            .interpolationMethod(.monotone)
        }
    }
}
