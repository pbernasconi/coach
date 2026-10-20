import Charts
import Foundation
import KoboTokens
import SwiftUI

/// Bars stacked by category over evenly spaced periods (hours per activity per week): a colour per category with a
/// legend, an optional dashed average line, a faded partial period, and a dot row under marked bars. Touching a bar
/// shows its categories and total. VoiceOver reads the label and "8 bars, average 5.2, highest 9 on Mar 4".
///
///     KoboStackedBarChart(
///         groups: weeks,                      // [BarGroup<Date>]
///         categories: [BarCategory(id: "walk", name: "Walk"), BarCategory(id: "swim", name: "Swim")],
///         reference: ChartReference(y: 5.2, label: "Avg 5.2 h"),
///         markLabel: "Long outing",
///         xText: ChartFormat.date,
///         yText: { "\(Int($0)) h" },
///         accessibilityLabel: "Hours per week"
///     )
public struct KoboStackedBarChart<X: KoboChartX>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .caption) private var scale = 1
    @ScaledMetric(relativeTo: .caption) private var dot = Space.xs + Space.xxs
    @State private var selected: Int?
    private let groups: [BarGroup<X>]
    private let categories: [BarCategory]
    private let reference: ChartReference?
    private let markLabel: String?
    private let height: ChartHeight
    private let xText: (X) -> String
    private let yText: (Double) -> String
    private let label: Text

    /// - Parameters:
    ///   - groups: oldest first, one bar each.
    ///   - reference: a dashed line, such as the average.
    ///   - markLabel: what the dot under a marked bar means, shown as is under the chart.
    public init(
        groups: [BarGroup<X>],
        categories: [BarCategory],
        reference: ChartReference? = nil,
        markLabel: String? = nil,
        height: ChartHeight = .regular,
        xText: @escaping (X) -> String,
        yText: @escaping (Double) -> String = ChartFormat.number,
        accessibilityLabel: LocalizedStringKey
    ) {
        self.groups = groups
        self.categories = categories
        self.reference = reference
        self.markLabel = markLabel
        self.height = height
        self.xText = xText
        self.yText = yText
        self.label = Text(accessibilityLabel)
    }

    public var body: some View {
        if groups.isEmpty {
            ChartEmpty(height: height.points * scale, label: label)
        } else {
            VStack(alignment: .leading, spacing: Space.xs) {
                chart
                if let markLabel, groups.contains(where: \.isMarked) {
                    Label {
                        Text(verbatim: markLabel)
                    } icon: {
                        Circle().fill(theme.palette.textPrimary).frame(width: dot, height: dot)
                    }
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                    .accessibilityHidden(true)
                }
            }
        }
    }

    private var chart: some View {
        Chart {
            ForEach(Array(groups.enumerated()), id: \.offset) { index, group in
                ForEach(group.segments(categories), id: \.category) { segment in
                    bar(index: index, group: group, category: segment.category, span: segment.span)
                }
            }
            referenceMark
            selectionMark
        }
        .chartXScale(domain: -0.5...(Double(groups.count) - 0.5))
        .chartYScale(domain: yDomain)
        .chartForegroundStyleScale(domain: categories.map(\.name), range: categories.indices.map(color(at:)))
        .chartLegend(position: .bottom, alignment: .leading)
        .chartXAxis { xAxis }
        .chartYAxis { yAxis }
        .chartXSelection(value: selection)
        .frame(height: height.points * scale)
        .koboAnimation(.state, value: groups)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(Text(verbatim: summary))
    }

    private func bar(index: Int, group: BarGroup<X>, category: Int, span: Range<Double>) -> some ChartContent {
        let faded = group.isPartial || (selected != nil && selected != index)
        let center = Double(index)
        return RectangleMark(
            xStart: .value("Start", center - 0.36),
            xEnd: .value("End", center + 0.36),
            yStart: .value("Low", span.lowerBound),
            yEnd: .value("High", span.upperBound)
        )
        .foregroundStyle(by: .value("Category", categories[category].name))
        .opacity(faded ? 0.45 : 1)
    }

    @ChartContentBuilder private var referenceMark: some ChartContent {
        if let reference {
            RuleMark(y: .value("Reference", reference.y))
                .foregroundStyle(theme.palette.textSecondary)
                .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xs, Space.xs]))
                .annotation(position: .top, alignment: .leading, spacing: Space.xxs) {
                    Text(verbatim: reference.label)
                        .font(theme.font(.caption).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                }
        }
    }

    @ChartContentBuilder private var selectionMark: some ChartContent {
        if let selected, groups.indices.contains(selected) {
            RuleMark(x: .value("Selected", Double(selected)))
                .foregroundStyle(Color.clear)
                .annotation(position: .top, spacing: 0, overflowResolution: .init(x: .fit(to: .chart), y: .disabled)) {
                    ChartCallout(title: xText(groups[selected].x), rows: calloutRows(groups[selected]))
                }
        }
    }

    private var yDomain: ClosedRange<Double> {
        ChartMath.domain(groups.map(\.total) + [reference?.y ?? 0], padding: 0.1, includesZero: true)
    }

    private var summary: String {
        ChartSpeech.bars(totals: groups.map(\.total), labels: groups.map { xText($0.x) }, format: yText)
    }

    /// Selection snapped to the nearest bar.
    private var selection: Binding<Double?> {
        Binding(
            get: { selected.map(Double.init) },
            set: { value in
                selected = value.map { min(max(Int($0.rounded()), 0), groups.count - 1) }
            }
        )
    }

    @AxisContentBuilder private var xAxis: some AxisContent {
        let maxLabels = dynamicTypeSize.isAccessibilitySize ? 3 : 6
        AxisMarks(values: ChartMath.thinned(groups.indices.map(Double.init), to: maxLabels)) { value in
            AxisValueLabel {
                if let index = value.as(Double.self).map({ Int($0.rounded()) }), groups.indices.contains(index) {
                    xLabel(groups[index])
                }
            }
        }
    }

    private func xLabel(_ group: BarGroup<X>) -> some View {
        VStack(spacing: Space.xxs) {
            Circle()
                .fill(group.isMarked ? theme.palette.textPrimary : .clear)
                .frame(width: dot, height: dot)
            Text(verbatim: xText(group.x))
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textSecondary)
        }
    }

    @AxisContentBuilder private var yAxis: some AxisContent {
        AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { value in
            AxisGridLine().foregroundStyle(theme.palette.separator)
            AxisValueLabel {
                if let y = value.as(Double.self) {
                    Text(verbatim: yText(y)).font(theme.font(.caption)).foregroundStyle(theme.palette.textSecondary)
                }
            }
        }
    }

    private func color(at index: Int) -> Color {
        categories[index].color ?? theme.palette.chartColor(index)
    }

    private func calloutRows(_ group: BarGroup<X>) -> [ChartCallout.Row] {
        let rows = categories.enumerated().compactMap { index, category -> ChartCallout.Row? in
            guard let value = group.values[category.id], value > 0 else { return nil }
            return ChartCallout.Row(name: category.name, value: yText(value), color: color(at: index))
        }
        let total = ChartCallout.Row(
            name: String(localized: "Total", bundle: .module),
            value: yText(group.total),
            color: .clear
        )
        return rows.count > 1 ? rows + [total] : rows
    }
}
