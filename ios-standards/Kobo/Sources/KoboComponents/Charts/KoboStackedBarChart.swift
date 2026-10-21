import Charts
import Foundation
import KoboTokens
import SwiftUI

/// Bars stacked by category over evenly spaced periods (hours per activity per week): a colour per category with a
/// legend, an optional dashed average line (named in the legend under the chart, never over the bars), a faded partial
/// period, and a dot row under marked bars. Touching a bar
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
    private var label: Text

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

    /// A chart whose accessibility label is shown as is (it names user data).
    public init(
        groups: [BarGroup<X>],
        categories: [BarCategory],
        reference: ChartReference? = nil,
        markLabel: String? = nil,
        height: ChartHeight = .regular,
        xText: @escaping (X) -> String,
        yText: @escaping (Double) -> String = ChartFormat.number,
        verbatimAccessibilityLabel: String
    ) {
        self.init(
            groups: groups,
            categories: categories,
            reference: reference,
            markLabel: markLabel,
            height: height,
            xText: xText,
            yText: yText,
            accessibilityLabel: ""
        )
        self.label = Text(verbatim: verbatimAccessibilityLabel)
    }

    public var body: some View {
        if groups.isEmpty {
            ChartEmpty(height: height.points * scale, label: label)
        } else {
            VStack(alignment: .leading, spacing: Space.xs) {
                chart
                StackedBarLegend(
                    reference: reference?.label,
                    markLabel: groups.contains(where: \.isMarked) ? markLabel : nil,
                    dot: dot
                )
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
            dotMarks
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
        let faded = group.isPartial || (selected != nil && selected != index)  // the period still filling
        let center = Double(index)
        return RectangleMark(
            xStart: .value("Start", center - 0.36),
            xEnd: .value("End", center + 0.36),
            yStart: .value("Low", span.lowerBound),
            yEnd: .value("High", span.upperBound)
        )
        .foregroundStyle(by: .value("Category", categories[category].name))
        .opacity(faded ? 0.35 : 1)
    }

    @ChartContentBuilder private var referenceMark: some ChartContent {
        if let reference {
            RuleMark(y: .value("Reference", reference.y))
                .foregroundStyle(theme.palette.textSecondary)
                .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xs, Space.xs]))
        }
    }

    /// A dot under each marked bar, just below the baseline, above its date label.
    @ChartContentBuilder private var dotMarks: some ChartContent {
        ForEach(Array(groups.enumerated()), id: \.offset) { index, group in
            if group.isMarked {
                PointMark(x: .value("Dot", Double(index)), y: .value("Zero", 0))
                    .foregroundStyle(theme.palette.textPrimary)
                    .symbolSize(dot * dot)
                    .offset(y: dot + Space.xs)
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
        // The partial period is left out, as it is from the average line.
        let whole = groups.filter { !$0.isPartial }
        return ChartSpeech.bars(totals: whole.map(\.total), labels: whole.map { xText($0.x) }, format: yText)
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
        AxisMarks(values: ChartMath.strideIndices(count: groups.count, maxCount: maxLabels).map(Double.init)) { value in
            AxisValueLabel {
                if let index = value.as(Double.self).map({ Int($0.rounded()) }), groups.indices.contains(index) {
                    xLabel(groups[index])
                }
            }
        }
    }

    private func xLabel(_ group: BarGroup<X>) -> some View {
        // Leaves room under the baseline for the dot row (`dotMarks`).
        VStack(spacing: Space.xxs) {
            Color.clear.frame(width: dot, height: groups.contains(where: \.isMarked) ? dot + Space.xs : 0)
            Text(verbatim: xText(group.x))
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize()  // the last bar's label may run past the plot rather than truncate
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
