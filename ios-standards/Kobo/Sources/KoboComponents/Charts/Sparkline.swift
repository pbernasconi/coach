import Charts
import Foundation
import KoboTokens
import SwiftUI

/// A small trend line with no axes, sized for a tile or a row: optionally filled below, with a dot on the latest value
/// and a dashed reference (a goal, an average). Values are evenly spaced, oldest first. VoiceOver reads the label and a
/// summary ("From 4 to 7, low 3, high 9").
///
///     Sparkline(values: lastEightWeeks, accessibilityLabel: "Hours per week")
///     Sparkline(values: daily, style: .area, reference: goal, color: theme.palette.info.ink,
///               format: { "\(Int($0)) min" }, accessibilityLabel: "Daily minutes")
public struct Sparkline: View {
    /// How the line is drawn.
    public enum Style: Sendable {
        /// A line alone.
        case line
        /// A line with a soft fill below it.
        case area
    }

    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var height = Size.minTouch * 0.75
    private let values: [Double]
    private let style: Style
    private let reference: Double?
    private let showsLastPoint: Bool
    private let color: Color?
    private let format: (Double) -> String
    private let label: Text

    /// - Parameters:
    ///   - values: oldest first; non-finite values are skipped.
    ///   - reference: a dashed line at this value.
    ///   - color: the line colour; the theme's accent when `nil`.
    ///   - format: number text for the VoiceOver summary.
    public init(
        values: [Double],
        style: Style = .line,
        reference: Double? = nil,
        showsLastPoint: Bool = true,
        color: Color? = nil,
        format: @escaping (Double) -> String = ChartFormat.number,
        accessibilityLabel: LocalizedStringKey
    ) {
        self.init(values, style, reference, showsLastPoint, color, format, Text(accessibilityLabel))
    }

    /// A sparkline whose accessibility label is shown as is (it names user data).
    public init(
        values: [Double],
        style: Style = .line,
        reference: Double? = nil,
        showsLastPoint: Bool = true,
        color: Color? = nil,
        format: @escaping (Double) -> String = ChartFormat.number,
        verbatimAccessibilityLabel: String
    ) {
        let label = Text(verbatim: verbatimAccessibilityLabel)
        self.init(values, style, reference, showsLastPoint, color, format, label)
    }

    private init(
        _ values: [Double],
        _ style: Style,
        _ reference: Double?,
        _ showsLastPoint: Bool,
        _ color: Color?,
        _ format: @escaping (Double) -> String,
        _ label: Text
    ) {
        self.values = values.filter(\.isFinite)
        self.style = style
        self.reference = reference
        self.showsLastPoint = showsLastPoint
        self.color = color
        self.format = format
        self.label = label
    }

    public var body: some View {
        let domain = ChartMath.domain(values + (reference.map { [$0] } ?? []), padding: 0.12)
        Chart {
            if let reference {
                RuleMark(y: .value("Reference", reference))
                    .foregroundStyle(theme.palette.textTertiary)
                    .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xxs, Space.xxs]))
            }
            ForEach(Array(values.enumerated()), id: \.offset) { index, value in
                if style == .area {
                    AreaMark(
                        x: .value("Index", index),
                        yStart: .value("Base", domain.lowerBound),
                        yEnd: .value("Value", value)
                    )
                    .foregroundStyle(lineColor.opacity(0.18))
                    .interpolationMethod(.monotone)
                }
                LineMark(x: .value("Index", index), y: .value("Value", value))
                    .foregroundStyle(lineColor)
                    .lineStyle(StrokeStyle(lineWidth: Space.xxs, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.monotone)
            }
            if showsLastPoint, let last = values.last {
                PointMark(x: .value("Index", values.count - 1), y: .value("Value", last))
                    .foregroundStyle(lineColor)
                    .symbolSize(Space.xxl)
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .chartXScale(domain: 0...max(values.count - 1, 1))
        .chartYScale(domain: domain)
        .frame(height: height)
        .koboAnimation(.state, value: values)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(Text(verbatim: ChartSpeech.series(values, format: format)))
    }

    private var lineColor: Color { color ?? theme.palette.accent }
}

private struct SparklinePreview: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(spacing: Space.lg) {
            Sparkline(values: [3, 5, 4, 6, 8, 7, 9, 8], accessibilityLabel: "Hours per week")
            Sparkline(
                values: [42, 40, 44, 39, 37, 38, 35],
                style: .area,
                reference: 40,
                color: theme.palette.info.ink,
                accessibilityLabel: "Average minutes"
            )
            HStack(spacing: Space.sm) {
                StatTile(label: "Distance", value: "42.1", unit: "km") {
                    Sparkline(values: [20, 28, 25, 31, 36, 42], accessibilityLabel: "Distance trend")
                }
                StatTile(label: "Pages read", value: "312") {
                    Sparkline(values: [80, 60, 75, 40, 52], style: .area, accessibilityLabel: "Pages trend")
                }
            }
        }
        .padding()
        .background(theme.palette.canvas)
    }
}

#if DEBUG
    #Preview("Sparkline") { SparklinePreview() }
    #Preview("Sparkline, dark") { SparklinePreview().preferredColorScheme(.dark) }
    #Preview("Sparkline, AX3") { SparklinePreview().dynamicTypeSize(.accessibility3) }
#endif
