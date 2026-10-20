import Charts
import Foundation
import KoboTokens
import SwiftUI

/// The marks of a `KoboLineChart`, one builder per layer, back to front.
extension KoboLineChart {
    @ChartContentBuilder var bandMarks: some ChartContent {
        if let xDomain {
            ForEach(Array(bands.enumerated()), id: \.offset) { _, band in
                RectangleMark(
                    xStart: .value("Start", xDomain.lowerBound),
                    xEnd: .value("End", xDomain.upperBound),
                    yStart: .value("Low", band.range.lowerBound),
                    yEnd: .value("High", band.range.upperBound)
                )
                .foregroundStyle(theme.palette.status(band.tone).soft.opacity(0.6))
                .annotation(position: .overlay, alignment: .topLeading, spacing: Space.xxs) {
                    if !band.label.isEmpty {
                        Text(verbatim: band.label)
                            .font(theme.font(.caption))
                            .foregroundStyle(theme.palette.status(band.tone).ink)
                            .padding(.leading, Space.xs)
                    }
                }
            }
        }
    }

    @ChartContentBuilder var seriesMarks: some ChartContent {
        ForEach(Array(series.enumerated()), id: \.element.id) { index, line in
            let color = color(at: index)
            ForEach(line.points, id: \.x) { point in
                if line.fillsArea {
                    AreaMark(
                        x: .value("X", point.x),
                        yStart: .value("Base", areaBase),
                        yEnd: .value(line.name, point.y),
                        series: .value("Series", "\(line.id)-area")
                    )
                    .foregroundStyle(color.opacity(0.16))
                }
                LineMark(x: .value("X", point.x), y: .value(line.name, point.y), series: .value("Series", line.id))
                    .foregroundStyle(by: .value("Series", line.name))
                    .lineStyle(line.strokeStyle)
                if line.showsPoints {
                    PointMark(x: .value("X", point.x), y: .value(line.name, point.y))
                        .foregroundStyle(color)
                        .symbolSize(Space.xxl)
                }
            }
        }
    }

    @ChartContentBuilder var referenceMarks: some ChartContent {
        ForEach(Array(references.enumerated()), id: \.offset) { _, reference in
            RuleMark(y: .value("Reference", reference.y))
                .foregroundStyle(theme.palette.textSecondary)
                .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xs, Space.xs]))
                .annotation(position: .top, alignment: .trailing, spacing: Space.xxs) {
                    if !reference.label.isEmpty {
                        Text(verbatim: reference.label)
                            .font(theme.font(.caption).weight(.semibold))
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
        }
    }

    @ChartContentBuilder var markerMarks: some ChartContent {
        ForEach(Array(markers.enumerated()), id: \.offset) { _, marker in
            if let y = marker.y {
                PointMark(x: .value("X", marker.x), y: .value("Y", y))
                    .foregroundStyle(theme.palette.status(marker.tone).ink)
                    .symbolSize(Space.xxxl * 2)
                    .annotation(position: .top, spacing: Space.xxs) { markerLabel(marker) }
            } else {
                RuleMark(x: .value("X", marker.x))
                    .foregroundStyle(theme.palette.status(marker.tone).ink)
                    .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xxs, Space.xxs]))
                    .annotation(position: .top, spacing: Space.xxs, overflowResolution: .init(x: .fit, y: .disabled)) {
                        markerLabel(marker)
                    }
            }
        }
    }

    @ChartContentBuilder var selectionMarks: some ChartContent {
        if let selected = selection.wrappedValue, let anchor = nearestX(to: selected) {
            RuleMark(x: .value("Selected", anchor))
                .foregroundStyle(theme.palette.textTertiary)
                .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2))
                .annotation(
                    position: .top,
                    spacing: 0,
                    overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                ) {
                    ChartCallout(title: xText(anchor), rows: calloutRows(at: anchor))
                }
            ForEach(Array(series.enumerated()), id: \.element.id) { index, line in
                if let point = line.nearest(to: anchor) {
                    PointMark(x: .value("X", point.x), y: .value("Y", point.y))
                        .foregroundStyle(color(at: index))
                        .symbolSize(Space.xxxl * 2)
                }
            }
        }
    }

    /// The x of the data point nearest a touch, across every series, so the crosshair snaps to real data.
    func nearestX(to x: X) -> X? {
        let xs = Array(Set(series.flatMap { $0.points.map(\.x) })).sorted()
        return ChartMath.nearestIndex(in: xs.map(\.chartPosition), to: x.chartPosition).map { xs[$0] }
    }

    func calloutRows(at x: X) -> [ChartCallout.Row] {
        series.enumerated().compactMap { index, line in
            guard let point = line.nearest(to: x) else { return nil }
            return ChartCallout.Row(name: line.name, value: yText(point.y), color: color(at: index))
        }
    }

    /// Where filled areas start: the bottom of the plot (the top when the y axis runs down).
    private var areaBase: Double { yDirection == .up ? yDomain.lowerBound : yDomain.upperBound }

    private func markerLabel(_ marker: ChartMarker<X>) -> some View {
        Text(verbatim: marker.label)
            .font(theme.font(.caption).weight(.semibold))
            .foregroundStyle(theme.palette.status(marker.tone).ink)
    }
}
