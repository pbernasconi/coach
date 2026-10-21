import Charts
import Foundation
import KoboTokens
import SwiftUI

/// The marks of a `KoboLineChart`, one builder per layer, back to front.
extension KoboLineChart {
    @ChartContentBuilder var bandMarks: some ChartContent {
        if let xDomain {
            ForEach(Array(visibleBands.enumerated()), id: \.offset) { _, band in
                RectangleMark(
                    xStart: .value("Start", xDomain.lowerBound),
                    xEnd: .value("End", xDomain.upperBound),
                    yStart: .value("Low", band.range.lowerBound),
                    yEnd: .value("High", band.range.upperBound)
                )
                .foregroundStyle(theme.palette.status(band.tone).soft.opacity(0.6))
                .annotation(position: .overlay, alignment: .topLeading, spacing: Space.xxs) {
                    if !band.label.isEmpty {
                        // On a chip, so a line that crosses the band never runs through the text.
                        Text(verbatim: band.label)
                            .font(theme.font(.caption))
                            .foregroundStyle(theme.palette.status(band.tone).ink)
                            .padding(.horizontal, Space.xs)
                            .padding(.vertical, Space.xxs / 2)
                            .background(
                                theme.palette.surface.opacity(0.9),
                                in: RoundedRectangle(cornerRadius: Radius.xs)
                            )
                            .fixedSize()
                            .padding(.leading, Space.xs)
                    }
                }
            }
        }
    }

    @ChartContentBuilder var seriesMarks: some ChartContent {
        let base = areaBase
        ForEach(Array(series.enumerated()), id: \.element.id) { index, line in
            let color = color(at: index)
            ForEach(Array(line.plotted.enumerated()), id: \.offset) { _, point in
                if line.fillsArea {
                    AreaMark(
                        x: .value("X", point.x),
                        yStart: .value("Base", base),
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
        ForEach(Array(markers.enumerated()), id: \.offset) { index, marker in
            if let y = marker.y {
                PointMark(x: .value("X", marker.x), y: .value("Y", y))
                    .foregroundStyle(theme.palette.status(marker.tone).ink)
                    .symbolSize(Space.xxxl * 2)
                    .annotation(
                        position: .top,
                        spacing: Space.xxs,
                        overflowResolution: .init(x: .fit(to: .plot), y: .fit(to: .plot))
                    ) {
                        // Every other rule's label one row lower, so two close events both stay readable.
                        markerLabel(marker).padding(.top, index.isMultiple(of: 2) ? 0 : markerRow)
                    }
            } else {
                // The label sits inside the plot at the rule's top, so it never shares a row with the legend.
                RuleMark(x: .value("X", marker.x))
                    .foregroundStyle(theme.palette.status(marker.tone).ink)
                    .lineStyle(StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xxs, Space.xxs]))
                    .annotation(
                        position: .overlay,
                        alignment: .top,
                        spacing: 0,
                        overflowResolution: .init(x: .fit(to: .plot), y: .fit(to: .plot))
                    ) {
                        // Every other rule's label one row lower, so two close events both stay readable.
                        markerLabel(marker).padding(.top, index.isMultiple(of: 2) ? 0 : markerRow)
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
                if let point = line.point(covering: anchor) {
                    PointMark(x: .value("X", point.x), y: .value("Y", point.y))
                        .foregroundStyle(color(at: index))
                        .symbolSize(Space.xxxl * 2)
                }
            }
        }
    }

    /// The x of the data point nearest a touch, across every series, so the crosshair snaps to real data.
    func nearestX(to x: X) -> X? {
        let xs = Array(Set(series.flatMap { $0.plotted.map(\.x) })).sorted()
        return ChartMath.nearestIndex(in: xs.map(\.chartPosition), to: x.chartPosition).map { xs[$0] }
    }

    func calloutRows(at x: X) -> [ChartCallout.Row] {
        series.enumerated().compactMap { index, line in
            guard let point = line.point(covering: x) else { return nil }
            return ChartCallout.Row(name: line.name, value: yText(point.y), color: color(at: index))
        }
    }

    /// The bands cut to the plotted y range, so a band never spills past the plot; bands fully outside are dropped.
    private var visibleBands: [ChartBand] {
        bands.compactMap { band in
            let low = max(band.range.lowerBound, yDomain.lowerBound)
            let high = min(band.range.upperBound, yDomain.upperBound)
            return low < high ? ChartBand(low...high, label: band.label, tone: band.tone) : nil
        }
    }

    /// Where filled areas start: the bottom of the plot (the top when the y axis runs down).
    private var areaBase: Double { yDirection == .up ? yDomain.lowerBound : yDomain.upperBound }

    /// A marker's name on a small surface chip, so it reads over the lines behind it.
    private func markerLabel(_ marker: ChartMarker<X>) -> some View {
        Text(verbatim: marker.label)
            .font(theme.font(.caption).weight(.semibold))
            .foregroundStyle(theme.palette.status(marker.tone).ink)
            .padding(.horizontal, Space.xs)
            .padding(.vertical, Space.xxs / 2)
            .background(theme.palette.surface.opacity(0.9), in: RoundedRectangle(cornerRadius: Radius.xs))
            .fixedSize()  // an overlay on a rule is offered the rule's hairline width
    }
}
