import Charts
import Foundation
import KoboTokens
import SwiftUI

/// One bar of a `VariableWidthBarChart`: how wide it is (a distance, a duration), its value (its height) and an
/// optional label for the callout ("4 min 55 s").
public struct WidthBar: Identifiable, Hashable, Sendable {
    public let id: String
    public let width: Double
    public let value: Double
    public let label: String?

    public init(id: String, width: Double, value: Double, label: String? = nil) {
        self.id = id
        self.width = width
        self.value = value
        self.label = label
    }
}

/// Bars laid end to end whose width is how long each part lasted and whose height is its value, so a long steady part
/// reads as a wide block and a short fast one as a narrow spike (splits along a route). With `yDirection: .down` the
/// bars still grow from the bottom, and a lower value makes a taller bar. Touching a bar shows its label.
///
///     VariableWidthBarChart(
///         bars: legs.map { WidthBar(id: $0.id, width: $0.distance, value: $0.minutes, label: $0.text) },
///         yDirection: .down,
///         xText: { "\(Int($0)) km" },
///         accessibilityLabel: "Splits"
///     )
public struct VariableWidthBarChart: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var scale = 1
    @State private var selected: Double?
    private let bars: [WidthBar]
    private let reference: ChartReference?
    private let yDirection: ChartYDirection
    private let color: Color?
    private let height: ChartHeight
    private let xText: (Double) -> String
    private let yText: (Double) -> String
    private var label: Text

    /// - Parameters:
    ///   - xText: text for the running total of widths along the axis.
    ///   - yText: text for values on the axis, in the callout (when a bar has no label) and in VoiceOver.
    public init(
        bars: [WidthBar],
        reference: ChartReference? = nil,
        yDirection: ChartYDirection = .up,
        color: Color? = nil,
        height: ChartHeight = .regular,
        xText: @escaping (Double) -> String = ChartFormat.number,
        yText: @escaping (Double) -> String = ChartFormat.number,
        accessibilityLabel: LocalizedStringKey
    ) {
        self.bars = bars.filter { $0.value.isFinite && $0.width.isFinite && $0.width > 0 }
        self.reference = reference
        self.yDirection = yDirection
        self.color = color
        self.height = height
        self.xText = xText
        self.yText = yText
        self.label = Text(accessibilityLabel)
    }

    /// A chart whose accessibility label is shown as is (it names user data).
    public init(
        bars: [WidthBar],
        reference: ChartReference? = nil,
        yDirection: ChartYDirection = .up,
        color: Color? = nil,
        height: ChartHeight = .regular,
        xText: @escaping (Double) -> String = ChartFormat.number,
        yText: @escaping (Double) -> String = ChartFormat.number,
        verbatimAccessibilityLabel: String
    ) {
        self.init(
            bars: bars,
            reference: reference,
            yDirection: yDirection,
            color: color,
            height: height,
            xText: xText,
            yText: yText,
            accessibilityLabel: ""
        )
        self.label = Text(verbatim: verbatimAccessibilityLabel)
    }

    public var body: some View {
        if let end = spans.last?.upperBound, end > 0 {
            Chart {
                ForEach(Array(bars.enumerated()), id: \.element.id) { index, bar in
                    mark(bar, span: spans[index], faded: selectedIndex.map { $0 != index } ?? false)
                }
                if let reference {
                    RuleMark(y: .value("Reference", reference.y))
                        .foregroundStyle(theme.palette.textSecondary)
                        .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xs, Space.xs]))
                }
                if let index = selectedIndex {
                    RuleMark(x: .value("Selected", (spans[index].lowerBound + spans[index].upperBound) / 2))
                        .foregroundStyle(Color.clear)
                        .annotation(
                            position: .top,
                            spacing: 0,
                            overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                        ) {
                            ChartCallout(title: xText(spans[index].upperBound), rows: [calloutRow(bars[index])])
                        }
                }
            }
            .chartXScale(domain: 0...end)
            .chartYScale(domain: yDirection == .up ? [yDomain.lowerBound, yDomain.upperBound] : yDomain.reversed)
            .chartAxes(xText: xText, yText: yText)
            .chartXSelection(value: $selected)
            .frame(height: height.points * scale)
            .koboAnimation(.state, value: bars)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue(Text(verbatim: ChartSpeech.series(bars.map(\.value), format: yText)))
        } else {
            ChartEmpty(height: height.points * scale, label: label)
        }
    }

    private var spans: [Range<Double>] { ChartMath.spans(widths: bars.map(\.width)) }

    private var yDomain: ClosedRange<Double> {
        ChartMath.domain(bars.map(\.value) + (reference.map { [$0.y] } ?? []), padding: 0.15)
    }

    /// The bar under the touch.
    private var selectedIndex: Int? {
        guard let selected else { return nil }
        if let index = spans.firstIndex(where: { $0.contains(selected) }) { return index }
        return selected >= (spans.last?.upperBound ?? 0) ? spans.indices.last : nil
    }

    private func mark(_ bar: WidthBar, span: Range<Double>, faded: Bool) -> some ChartContent {
        let base = yDirection == .up ? yDomain.lowerBound : yDomain.upperBound
        // A hairline gap between neighbours, so equal bars still read as separate parts.
        let gap = min((span.upperBound - span.lowerBound) * 0.1, (spans.last?.upperBound ?? 0) * 0.002)
        return RectangleMark(
            xStart: .value("Start", span.lowerBound + gap),
            xEnd: .value("End", span.upperBound - gap),
            yStart: .value("Base", base),
            yEnd: .value("Value", bar.value)
        )
        .foregroundStyle((color ?? theme.palette.accent).opacity(faded ? 0.45 : 1))
    }

    private func calloutRow(_ bar: WidthBar) -> ChartCallout.Row {
        ChartCallout.Row(name: "", value: bar.label ?? yText(bar.value), color: color ?? theme.palette.accent)
    }
}
