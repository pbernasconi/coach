import Charts
import Foundation
import KoboTokens
import SwiftUI

/// How values spread: one bar per bin, its height the number of values in it, with an optional labelled marker (the
/// average, a goal). VoiceOver reads the label and "Most values from 5 to 10, average 7.4".
///
///     KoboHistogram(values: durations, binWidth: 5, xText: { "\(Int($0)) min" }, accessibilityLabel: "Session length")
///     KoboHistogram(bins: bins, marker: ChartMarker(x: 7.4, label: "Avg"), xText: ChartFormat.number,
///                   accessibilityLabel: "Spread")
public struct KoboHistogram: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var scale = 1
    private let bins: [HistogramBin]
    private let marker: ChartMarker<Double>?
    private let color: Color?
    private let height: ChartHeight
    private let xText: (Double) -> String
    private var label: Text

    /// A histogram of ready-made bins.
    ///
    /// - Parameters:
    ///   - marker: a labelled vertical line, such as the average.
    ///   - color: the bars; the theme's accent when `nil`.
    ///   - xText: text for bin edges on the axis and in the VoiceOver summary.
    public init(
        bins: [HistogramBin],
        marker: ChartMarker<Double>? = nil,
        color: Color? = nil,
        height: ChartHeight = .regular,
        xText: @escaping (Double) -> String = ChartFormat.number,
        accessibilityLabel: LocalizedStringKey
    ) {
        self.bins = bins
        self.marker = marker
        self.color = color
        self.height = height
        self.xText = xText
        self.label = Text(accessibilityLabel)
    }

    /// A histogram that bins `values` itself (`HistogramBin.bins(_:width:)`) and, with `averageLabel`, marks the mean.
    public init(
        values: [Double],
        binWidth: Double,
        averageLabel: String? = nil,
        color: Color? = nil,
        height: ChartHeight = .regular,
        xText: @escaping (Double) -> String = ChartFormat.number,
        accessibilityLabel: LocalizedStringKey
    ) {
        let marker = averageLabel.flatMap { text in ChartMath.mean(values).map { ChartMarker(x: $0, label: text) } }
        self.init(
            bins: HistogramBin.bins(values, width: binWidth),
            marker: marker,
            color: color,
            height: height,
            xText: xText,
            accessibilityLabel: accessibilityLabel
        )
    }

    /// A histogram of ready-made bins whose accessibility label is shown as is (it names user data).
    public init(
        bins: [HistogramBin],
        marker: ChartMarker<Double>? = nil,
        color: Color? = nil,
        height: ChartHeight = .regular,
        xText: @escaping (Double) -> String = ChartFormat.number,
        verbatimAccessibilityLabel: String
    ) {
        self.init(bins: bins, marker: marker, color: color, height: height, xText: xText, accessibilityLabel: "")
        self.label = Text(verbatim: verbatimAccessibilityLabel)
    }

    public var body: some View {
        if let low = bins.map({ min($0.lower, $0.upper) }).min(),
            let high = bins.map({ max($0.lower, $0.upper) }).max(),
            low.isFinite, high.isFinite, low < high
        {
            Chart {
                ForEach(Array(bins.enumerated()), id: \.offset) { _, bin in
                    RectangleMark(
                        xStart: .value("Lower", bin.lower),
                        xEnd: .value("Upper", bin.upper),
                        yStart: .value("Zero", 0),
                        yEnd: .value("Count", bin.count)
                    )
                    .foregroundStyle(color ?? theme.palette.accent)
                    .cornerRadius(Radius.xs / 2)
                }
                if let marker {
                    RuleMark(x: .value("Marker", marker.x))
                        .foregroundStyle(theme.palette.status(marker.tone).ink)
                        .lineStyle(StrokeStyle(lineWidth: Space.xxs, dash: [Space.xs, Space.xs]))
                        .annotation(
                            position: .top,
                            spacing: Space.xxs,
                            overflowResolution: .init(x: .fit, y: .disabled)
                        ) {
                            Text(verbatim: marker.label)
                                .font(theme.font(.caption).weight(.semibold))
                                .foregroundStyle(theme.palette.status(marker.tone).ink)
                        }
                }
            }
            .chartXScale(domain: low...high)
            .chartAxes(xTicks: edges, xText: xText, yText: ChartFormat.number)
            .frame(height: height.points * scale)
            .koboAnimation(.state, value: bins)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue(Text(verbatim: ChartSpeech.histogram(bins, average: marker?.x, format: xText)))
        } else {
            ChartEmpty(height: height.points * scale, label: label)
        }
    }

    /// Every bin edge, so labels sit on bar boundaries (thinned by the axes).
    private var edges: [Double] {
        Array(Set(bins.flatMap { [$0.lower, $0.upper] }.filter(\.isFinite))).sorted()
    }
}

private struct KoboHistogramPreview: View {
    @Environment(\.koboTheme) private var theme
    private let minutes: [Double] = [22, 25, 31, 34, 35, 38, 41, 42, 44, 45, 45, 47, 52, 55, 61, 64, 75, 90]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xl) {
            KoboHistogram(
                values: minutes,
                binWidth: 10,
                averageLabel: "Avg",
                xText: { "\(Int($0))′" },
                accessibilityLabel: "Session length"
            )
            KoboHistogram(bins: [], accessibilityLabel: "Empty")
        }
        .padding()
        .background(theme.palette.canvas)
    }
}

#if DEBUG
    #Preview("Histogram") { KoboHistogramPreview() }
    #Preview("Histogram, dark") { KoboHistogramPreview().preferredColorScheme(.dark) }
    #Preview("Histogram, AX3") { KoboHistogramPreview().dynamicTypeSize(.accessibility3) }
#endif
