import KoboComponents
import KoboTokens
import SwiftUI

/// The analysis charts: one panel per stream on a shared x axis (distance or time), touch to read every panel at the
/// same moment. Pace runs upside down (faster is higher) with GAP dashed over it; elevation is filled.
struct ActivityAnalysisView: View {
    let analysis: ActivityAnalysis
    let axis: AnalysisAxis
    let send: (ActivityDetailAction) -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if let empty = analysis.emptyText, analysis.streams.isEmpty {
                SectionState(verbatim: empty)
            } else if let x = analysis.x {
                if !x.distanceKm.isEmpty {
                    SegmentedPicker(
                        "Chart axis",
                        selection: .action(axis) { send(.axisChanged($0)) },
                        options: [
                            ChoiceOption(AnalysisAxis.distance, title: "Distance"),
                            ChoiceOption(AnalysisAxis.time, title: "Time"),
                        ]
                    )
                }
                KoboLinePanels(panels: panels(x: x), xText: { ActivityAxisText.axis($0, axis: shownAxis(x)) })
                if let note = analysis.note {
                    Text(verbatim: note).font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
                }
            }
        }
    }

    /// Distance when the activity has it and it is picked, else time.
    private func shownAxis(_ x: ActivityAnalysis.Axes) -> AnalysisAxis {
        axis == .distance && !x.distanceKm.isEmpty ? .distance : .time
    }

    private func panels(x: ActivityAnalysis.Axes) -> [LinePanel<Double>] {
        let xs = shownAxis(x) == .distance ? x.distanceKm : x.timeS
        return analysis.streams.enumerated().compactMap { index, stream in
            guard stream.overlayOf == nil else { return nil }
            let overlays = analysis.streams.filter { $0.overlayOf == stream.key }
            let series =
                [line(stream, xs: xs, color: ActivityStreamColor.color(stream.key, index: index, palette: theme.palette), dashed: false)]
                + overlays.map { line($0, xs: xs, color: theme.palette.textSecondary, dashed: true) }
            let title = [stream.label, stream.avgText.map { String(localized: "avg \($0)") }].compactMap(\.self)
                .joined(separator: " · ")
            return LinePanel(
                id: stream.key,
                title: title,
                series: series,
                yDirection: stream.invert ? .down : .up,
                yText: { ActivityAxisText.stream($0, unit: stream.unit) }
            )
        }
    }

    private func line(_ stream: ActivityAnalysis.Stream, xs: [Double], color: Color, dashed: Bool) -> ChartSeries<
        Double
    > {
        let points = zip(xs, stream.values).compactMap { x, y in y.map { ChartPoint(x: x, y: $0) } }
        return ChartSeries(
            id: stream.key,
            name: stream.label,
            points: points,
            color: color,
            stroke: dashed ? .dashed : .solid,
            fillsArea: stream.area
        )
    }
}
