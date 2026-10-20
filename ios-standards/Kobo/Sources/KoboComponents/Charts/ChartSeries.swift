import Foundation
import KoboTokens
import SwiftUI

/// One line of a `KoboLineChart`: a name, its points in x order, and how it is drawn. A dashed stroke marks a
/// projection or a target; the legend and the callout pair each colour with the name, so colour is never alone.
///
///     ChartSeries(id: "actual", name: "Actual", points: actual)
///     ChartSeries(id: "plan", name: "Plan", points: plan, color: theme.palette.textTertiary, stroke: .dashed)
public struct ChartSeries<X: KoboChartX>: Identifiable, Hashable, Sendable {
    /// How a line is stroked.
    public enum Stroke: Hashable, Sendable {
        /// A solid line: measured values.
        case solid
        /// A dashed line: projections, plans and targets.
        case dashed
    }

    public let id: String
    public let name: String
    public let points: [ChartPoint<X>]
    public let color: Color?
    public let stroke: Stroke
    public let fillsArea: Bool
    public let showsPoints: Bool

    /// - Parameters:
    ///   - name: shown as is in the legend, the callout and the VoiceOver summary.
    ///   - points: sorted by x here, so callers can pass them in any order. Non-finite values are dropped.
    ///   - color: the line colour; the theme's `chartColor` for the series' position when `nil`.
    ///   - fillsArea: a soft fill under the line.
    ///   - showsPoints: a dot on every point (for sparse data).
    public init(
        id: String,
        name: String,
        points: [ChartPoint<X>],
        color: Color? = nil,
        stroke: Stroke = .solid,
        fillsArea: Bool = false,
        showsPoints: Bool = false
    ) {
        self.id = id
        self.name = name
        self.points = points.filter(\.y.isFinite).sorted { $0.x < $1.x }
        self.color = color
        self.stroke = stroke
        self.fillsArea = fillsArea
        self.showsPoints = showsPoints
    }

    var strokeStyle: StrokeStyle {
        switch stroke {
        case .solid: StrokeStyle(lineWidth: Space.xxs, lineCap: .round, lineJoin: .round)
        case .dashed: StrokeStyle(lineWidth: Space.xxs * 0.75, lineCap: .round, dash: [Space.xs, Space.xs])
        }
    }

    /// The point nearest `x`, or `nil` for an empty series.
    func nearest(to x: X) -> ChartPoint<X>? {
        ChartMath.nearestIndex(in: points.map(\.x.chartPosition), to: x.chartPosition).map { points[$0] }
    }
}

/// Which way a chart's y axis runs.
public enum ChartYDirection: Sendable {
    /// Larger values higher up.
    case up
    /// Larger values lower down, for values where less is better (a time per distance, a rank).
    case down
}
