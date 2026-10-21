import KoboComponents
import KoboTokens
import SwiftUI

/// The pace (or speed) bars: splits or laps as bars as wide as their distance and as tall as their speed, or the
/// smoothed speed over time. The dashed line is the average.
struct ActivityPaceBarsView: View {
    let bars: ActivityPaceBars
    let mode: String?
    let send: (ActivityDetailAction) -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            SectionHeader(verbatim: bars.title)
            if bars.modes.count > 1 {
                SegmentedPicker(
                    "Pace view",
                    selection: .action(shown?.key ?? "") { send(.paceModeChanged($0)) },
                    options: bars.modes.map { ChoiceOption($0.key, verbatim: Self.title(of: $0.key)) }
                )
            }
            if let shown { chart(shown) }
        }
    }

    private var shown: ActivityPaceBars.Mode? {
        bars.modes.first { $0.key == mode } ?? bars.modes.first
    }

    @ViewBuilder
    private func chart(_ mode: ActivityPaceBars.Mode) -> some View {
        if !mode.bars.isEmpty {
            VariableWidthBarChart(
                bars: mode.bars.enumerated().map { index, bar in
                    WidthBar(
                        id: "\(index)",
                        width: bar.width ?? 0,  // the chart leaves out a part with no width
                        value: bar.value ?? 0,
                        label: "\(bar.label) · \(bar.valueText)"
                    )
                },
                reference: mode.avg.map {
                    ChartReference(y: $0, label: mode.avgText.map { String(localized: "avg \($0)") } ?? "")
                },
                xText: { ActivityAxisText.axis($0 / 1000, axis: .distance) },
                yText: { ActivityAxisText.speed($0, unit: bars.unit) },
                accessibilityLabel: "Pace per part"
            )
            if let gap = mode.gapAvgText {
                Text("GAP avg \(gap)").font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
            }
        } else if !mode.timeS.isEmpty {
            KoboLineChart(
                series: smoothed(times: mode.timeS, values: mode.values, gap: mode.gapValues),
                xText: { ActivityAxisText.clock($0) },
                yText: { ActivityAxisText.speed($0, unit: bars.unit) },
                accessibilityLabel: "Smoothed pace"
            )
        }
    }

    private func smoothed(times: [Double], values: [Double?], gap: [Double?]) -> [ChartSeries<Double>] {
        func points(_ ys: [Double?]) -> [ChartPoint<Double>] {
            zip(times, ys).compactMap { x, y in y.map { ChartPoint(x: x, y: $0) } }
        }
        let speed = ChartSeries(id: "speed", name: String(localized: "Speed"), points: points(values), fillsArea: true)
        guard !gap.isEmpty else { return [speed] }
        let gapLine = ChartSeries(
            id: "gap",
            name: "GAP",
            points: points(gap),
            color: theme.palette.textSecondary,
            stroke: .dashed
        )
        return [speed, gapLine]
    }

    static func title(of key: String) -> String {
        switch key {
        case "splits": String(localized: "Splits")
        case "laps": String(localized: "Laps")
        case "smoothed": String(localized: "Smoothed")
        default: key.capitalized
        }
    }
}

/// Moving time per 15 s of pace, with the average pace marked.
struct ActivityPaceHistogramView: View {
    let histogram: ActivityPaceHistogram
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            KoboHistogram(
                bins: histogram.bins.map {
                    HistogramBin(lower: $0.fromS, upper: $0.toS, count: Int($0.seconds.rounded()))
                },
                marker: marker,
                xText: { ActivityAxisText.clock($0) },
                accessibilityLabel: "Pace distribution"
            )
            .countText { ActivityAxisText.clock($0) }
            if let note = histogram.note {
                Text(verbatim: note).font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
            }
        }
    }

    private var marker: ChartMarker<Double>? {
        guard let index = histogram.avgIndex, histogram.bins.indices.contains(index) else { return nil }
        let bin = histogram.bins[index]
        return ChartMarker(x: (bin.fromS + bin.toS) / 2, label: histogram.avgText ?? "")
    }
}
