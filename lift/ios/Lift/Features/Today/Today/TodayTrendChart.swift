import Charts
import Foundation
import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// One metric's small chart: the normal band shaded behind the line, a dashed goal, and the latest value as a dot (red
/// when it is off). Weight draws its smoothed trend as the line and each weigh-in as a quiet dot. No axes.
struct TodayTrendChart: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var height = Size.thumbnail
    let scale: TodayTrendScale
    let trend: HealthTrend

    var body: some View {
        Chart {
            if let band = trend.band {
                RectangleMark(
                    xStart: .value("Start", scale.start),
                    xEnd: .value("End", scale.end),
                    yStart: .value("Low", band.low),
                    yEnd: .value("High", band.high)
                )
                .foregroundStyle(theme.palette.success.soft)
            }
            if let goal = trend.goal {
                RuleMark(y: .value("Goal", goal.value))
                    .foregroundStyle(theme.palette.textTertiary)
                    .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xxs, Space.xxs]))
            }
            ForEach(scale.dots, id: \.date) { dot in
                PointMark(x: .value("Day", dot.date), y: .value("Value", dot.value))
                    .foregroundStyle(theme.palette.textTertiary)
                    .symbolSize(Space.sm)
            }
            ForEach(scale.line, id: \.date) { point in
                LineMark(x: .value("Day", point.date), y: .value("Value", point.value))
                    .foregroundStyle(theme.palette.accent)
                    .lineStyle(StrokeStyle(lineWidth: Space.xxs, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.monotone)
            }
            if let last = scale.latest {
                PointMark(x: .value("Day", last.date), y: .value("Value", last.value))
                    .foregroundStyle(trend.isOff ? theme.palette.danger.ink : theme.palette.accent)
                    .symbolSize(Space.xxxl)
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .chartXScale(domain: scale.start...scale.end)
        .chartYScale(domain: scale.low...scale.high)
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

/// A trend's points as dates, and the chart's ranges: the days shown, and the values with the band and goal padded.
nonisolated struct TodayTrendScale: Equatable {
    struct Point: Equatable {
        let date: Date
        let value: Double
    }

    /// The line: the smoothed trend for weight, else the points.
    let line: [Point]
    /// Weight's weigh-ins under its trend line; empty for the others.
    let dots: [Point]
    /// The newest point.
    let latest: Point?
    let start: Date
    let end: Date
    let low: Double
    let high: Double

    init(_ trend: HealthTrend, calendar: Calendar) {
        func points(_ list: [HealthPoint]) -> [Point] {
            list.compactMap { point in point.date.day.startDate(in: calendar).map { Point(date: $0, value: point.value) } }
        }
        let measured = points(trend.points)
        let smoothed = trend.trendLine.map(points)
        line = smoothed ?? measured
        dots = smoothed == nil ? [] : measured
        latest = measured.last
        let dates = (line + dots).map(\.date)
        let first = dates.min() ?? .distantPast
        let last = dates.max() ?? first
        start = first
        end = last > first ? last : first.addingTimeInterval(86_400)
        let extra = [trend.band?.low, trend.band?.high, trend.goal?.value].compactMap(\.self)
        let values = (line + dots).map(\.value) + extra
        let lowest = values.min() ?? 0
        let highest = values.max() ?? 1
        let pad = highest > lowest ? (highest - lowest) * 0.1 : 1
        low = lowest - pad
        high = highest + pad
    }
}
