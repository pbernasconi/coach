import Accessibility
import Charts
import Foundation
import KoboTokens
import SwiftUI

extension KoboLineChart where X == Double {
    /// Puts x on a logarithmic scale, for spans such as 5 s to 1 h where the short end matters as much as the long one.
    /// Every x must be above zero.
    ///
    /// - Parameter ticks: the x values to label (5, 60, 300, 1200, 3600); 1, 2 and 5 of each decade when empty.
    public func logarithmicX(ticks: [Double] = []) -> Self {
        var copy = self
        copy.isLogarithmic = true
        copy.xTicks = ticks
        if ticks.isEmpty, let domain = xDomain {
            copy.xTicks = ChartMath.logTicks(lower: domain.lowerBound, upper: domain.upperBound, maxCount: 8)
        }
        return copy
    }
}

extension KoboLineChart {
    /// Labels exactly these x values instead of letting the chart choose (thinned at accessibility sizes).
    public func xAxisTicks(_ ticks: [X]) -> Self {
        var copy = self
        copy.xTicks = ticks
        return copy
    }

    /// Fixes the y range instead of fitting it to the data, so several charts compare on one scale.
    public func yDomain(_ domain: ClosedRange<Double>) -> Self {
        var copy = self
        copy.yDomainOverride = domain
        return copy
    }

    /// Shares an x range and hides the x labels; used by `KoboLinePanels` for every panel but the last.
    func panel(xDomain: ClosedRange<X>?, showsXLabels: Bool) -> Self {
        var copy = self
        copy.xDomainOverride = xDomain
        copy.showsXLabels = showsXLabels
        return copy
    }
}

/// The Audio Graph of a `KoboLineChart`: every series on numeric axes, with the chart's own value text.
struct LineChartDescriptor<X: KoboChartX>: AXChartDescriptorRepresentable {
    let chart: KoboLineChart<X>

    func makeChartDescriptor() -> AXChartDescriptor {
        let points = chart.series.flatMap(\.points)
        let xs = points.map(\.x.chartPosition)
        let ys = points.map(\.y)
        let xByPosition = Dictionary(points.map { ($0.x.chartPosition, $0.x) }, uniquingKeysWith: { first, _ in first })
        let xText = chart.xText
        let yText = chart.yText
        let xAxis = AXNumericDataAxisDescriptor(
            title: "",
            range: (xs.min() ?? 0)...(xs.max() ?? 1),
            gridlinePositions: []
        ) { position in xByPosition[position].map(xText) ?? "" }
        let yAxis = AXNumericDataAxisDescriptor(
            title: "",
            range: (ys.min() ?? 0)...(ys.max() ?? 1),
            gridlinePositions: []
        ) { yText($0) }
        let series = chart.series.map { line in
            AXDataSeriesDescriptor(
                name: line.name,
                isContinuous: true,
                dataPoints: line.points.map { AXDataPoint(x: $0.x.chartPosition, y: $0.y) }
            )
        }
        return AXChartDescriptor(title: nil, summary: chart.summary, xAxis: xAxis, yAxis: yAxis, series: series)
    }
}

/// The x scale of a line chart: the data's range, or the chart's own choice when the range has no width (one point),
/// so a single value never gets an empty domain.
struct ChartXScale<X: KoboChartX>: ViewModifier {
    let domain: ClosedRange<X>
    let isLogarithmic: Bool

    func body(content: Content) -> some View {
        if domain.lowerBound < domain.upperBound {
            content.chartXScale(domain: domain, type: isLogarithmic ? .log : nil)
        } else {
            content.chartXScale(type: isLogarithmic ? .log : nil)
        }
    }
}
