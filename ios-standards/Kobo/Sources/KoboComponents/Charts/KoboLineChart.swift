import Charts
import Foundation
import KoboTokens
import SwiftUI

/// A line chart over time or any numeric x: several series (solid or dashed, optionally filled), shaded bands with
/// labels, dashed reference lines, event markers ("Today"), and a touch crosshair with a callout of every series'
/// value. Set the y axis to run `.down` for values where less is better, and `.logarithmicX()` for spans such as 5 s to
/// 1 h. VoiceOver reads the label and a summary of each series; Audio Graphs play the data.
///
///     KoboLineChart(
///         series: [ChartSeries(id: "a", name: "Score", points: points, fillsArea: true)],
///         bands: [ChartBand(10...20, label: "Target", tone: .success)],
///         markers: [ChartMarker(x: today, label: "Today")],
///         xText: ChartFormat.date,
///         accessibilityLabel: "Score, last 90 days"
///     )
public struct KoboLineChart<X: KoboChartX>: View {
    @Environment(\.koboTheme) var theme
    @ScaledMetric(relativeTo: .caption) private var scale = 1
    @State private var ownSelection: X?
    let series: [ChartSeries<X>]
    let bands: [ChartBand]
    let references: [ChartReference]
    let markers: [ChartMarker<X>]
    let yDirection: ChartYDirection
    let height: ChartHeight
    let externalSelection: Binding<X?>?
    let xText: (X) -> String
    let yText: (Double) -> String
    var label: Text
    var isLogarithmic = false
    var xTicks: [X] = []
    var xDomainOverride: ClosedRange<X>?
    var yDomainOverride: ClosedRange<Double>?
    var showsXLabels = true

    /// - Parameters:
    ///   - selection: the touched x, to share between charts; the chart keeps its own when `nil`.
    ///   - xText: text for x values on the axis and in the callout.
    ///   - yText: text for y values on the axis, in the callout and in the VoiceOver summary.
    public init(
        series: [ChartSeries<X>],
        bands: [ChartBand] = [],
        references: [ChartReference] = [],
        markers: [ChartMarker<X>] = [],
        yDirection: ChartYDirection = .up,
        height: ChartHeight = .regular,
        selection: Binding<X?>? = nil,
        xText: @escaping (X) -> String,
        yText: @escaping (Double) -> String = ChartFormat.number,
        accessibilityLabel: LocalizedStringKey
    ) {
        self.series = series
        self.bands = bands
        self.references = references
        self.markers = markers
        self.yDirection = yDirection
        self.height = height
        self.externalSelection = selection
        self.xText = xText
        self.yText = yText
        self.label = Text(accessibilityLabel)
    }

    /// A chart whose accessibility label is shown as is (it names user data).
    public init(
        series: [ChartSeries<X>],
        bands: [ChartBand] = [],
        references: [ChartReference] = [],
        markers: [ChartMarker<X>] = [],
        yDirection: ChartYDirection = .up,
        height: ChartHeight = .regular,
        selection: Binding<X?>? = nil,
        xText: @escaping (X) -> String,
        yText: @escaping (Double) -> String = ChartFormat.number,
        verbatimAccessibilityLabel: String
    ) {
        self.init(
            series: series,
            bands: bands,
            references: references,
            markers: markers,
            yDirection: yDirection,
            height: height,
            selection: selection,
            xText: xText,
            yText: yText,
            accessibilityLabel: ""
        )
        self.label = Text(verbatim: verbatimAccessibilityLabel)
    }

    public var body: some View {
        if let xDomain {
            chart(xDomain: xDomain)
        } else {
            ChartEmpty(height: height.points * scale, label: label)
        }
    }

    private func chart(xDomain: ClosedRange<X>) -> some View {
        Chart {
            bandMarks
            seriesMarks
            referenceMarks
            markerMarks
            selectionMarks
        }
        .modifier(ChartXScale(domain: xDomain, isLogarithmic: isLogarithmic))
        .chartYScale(domain: yScaleDomain)
        .chartForegroundStyleScale(domain: series.map(\.name), range: series.indices.map(color(at:)))
        .chartLegend(series.count > 1 ? .visible : .hidden)
        .chartLegend(position: .top, alignment: .leading)
        .chartAxes(xTicks: xTicks, xText: xText, yText: yText, showsXLabels: showsXLabels)
        .chartXSelection(value: selection)
        .frame(height: height.points * scale)
        .koboAnimation(.state, value: series)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(Text(verbatim: summary))
        .accessibilityChartDescriptor(LineChartDescriptor(chart: self))
    }

    var selection: Binding<X?> { externalSelection ?? $ownSelection }

    /// The x range of the data, or `nil` when no series has a point.
    var xDomain: ClosedRange<X>? {
        let xs = series.flatMap { $0.points.map(\.x) }
        guard let low = xs.min(), let high = xs.max() else { return nil }
        if let xDomainOverride { return xDomainOverride }
        let all = xs + markers.map(\.x)
        return (all.min() ?? low)...(all.max() ?? high)
    }

    /// The y domain as the scale wants it: low to high, or high to low when the axis runs down.
    private var yScaleDomain: [Double] {
        yDirection == .up ? [yDomain.lowerBound, yDomain.upperBound] : [yDomain.upperBound, yDomain.lowerBound]
    }

    var yDomain: ClosedRange<Double> {
        if let yDomainOverride { return yDomainOverride }
        let values = series.flatMap { $0.points.map(\.y) } + references.map(\.y) + markers.compactMap(\.y)
        return ChartMath.domain(values)
    }

    func color(at index: Int) -> Color {
        series[index].color ?? theme.palette.chartColor(index)
    }

    var summary: String {
        ChartSpeech.lines(series.map { ($0.name, $0.points.map(\.y)) }, format: yText)
    }
}
