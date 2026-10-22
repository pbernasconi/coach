import KoboComponents
import KoboTokens
import SwiftUI

/// A page under the activity page: the full charts and tables that the summary keeps short.
struct ActivityPanelPage: View {
    let panel: ActivityPanel
    let detail: ActivityDetail
    let state: ActivityDetailState
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) { content }
                .pageColumn()
                .padding(.vertical, Space.md)
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: title))
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder private var content: some View {
        switch panel {
        case .charts:
            OptionalSection(nil, detail.analysis) { ActivityAnalysisView(analysis: $0, axis: state.axis, send: send) }
        case .pace:
            streamChart(["pace", "speed"])
            OptionalSection(nil, detail.paceBars) { ActivityPaceBarsView(bars: $0, mode: state.paceMode, send: send) }
            OptionalSection("Pace distribution", detail.paceHistogram) { ActivityPaceHistogramView(histogram: $0) }
            OptionalSection("Splits", detail.splits) { ActivitySplitsTable(splits: $0) }
        case .heartRate:
            streamChart(["hr"])
            OptionalSection("Zones", detail.heartRate) { ActivityZonesView(zones: $0) }
            OptionalSection("Effort", detail.relativeEffort) { ActivityEffortView(effort: $0) }
        case .power:
            streamChart(["watts"])
            OptionalSection(nil, detail.power) { ActivityPowerView(power: $0) }
        case .splits:
            OptionalSection(nil, detail.splits) { ActivitySplitsTable(splits: $0) }
        case .laps:
            OptionalSection(nil, detail.laps) { ActivityLapsTable(laps: $0) }
        case .bestEfforts:
            OptionalSection(nil, detail.bestEfforts) { ActivityBestEffortsTable(efforts: $0) }
        case .segments:
            OptionalSection(nil, detail.segments) { ActivitySegmentsTable(segments: $0) }
        case .sameRoute:
            OptionalSection(nil, detail.sameRoute) { ActivitySameRouteView(sameRoute: $0, send: send) }
        case .stats:
            OptionalSection(nil, detail.overview) { overview in
                if let groups = overview.groups, !groups.isEmpty {
                    // The web's groups: each value with its word ("268 ms · Average").
                    if let hero = overview.hero, !hero.isEmpty {
                        ListSection(verbatim: String(localized: "Summary")) {
                            ForEach(hero, id: \.key) { row in
                                KeyValueRow(
                                    verbatim: row.label,
                                    value: [[row.valueText, row.unit].compactMap(\.self).joined(separator: " "), row.sub]
                                        .compactMap(\.self).joined(separator: " · ")
                                )
                            }
                        }
                    }
                    ForEach(groups) { group in
                        ListSection(
                            verbatim: [group.title, group.tag].compactMap(\.self).joined(separator: " · "),
                            footer: group.footer.flatMap { $0.isEmpty ? nil : $0.joined(separator: " · ") }
                        ) {
                            ForEach(group.rows, id: \.key) { row in
                                KeyValueRow(
                                    verbatim: row.label,
                                    value: [[row.valueText, row.unit].compactMap(\.self).joined(separator: " "), row.word]
                                        .compactMap(\.self).joined(separator: " · ")
                                )
                            }
                        }
                    }
                } else {
                    ListSection {
                        ForEach(overview.moreStats, id: \.label) { stat in
                            KeyValueRow(
                                verbatim: stat.label,
                                value: [stat.valueText, stat.unit].compactMap(\.self).joined(separator: " ")
                            )
                        }
                    }
                }
            }
        }
    }

    /// The first of these streams as a full chart, in the colour its card had.
    @ViewBuilder private func streamChart(_ keys: [String]) -> some View {
        if let analysis = detail.analysis?.value, let x = analysis.x,
            let index = analysis.streams.firstIndex(where: { keys.contains($0.key) })
        {
            ActivityStreamChartPanel(stream: analysis.streams[index], x: x, index: index)
        }
    }

    private var title: String {
        switch panel {
        case .charts: String(localized: "Charts")
        case .pace: detail.analysis?.value?.streams.first { $0.key == "speed" }?.label ?? String(localized: "Pace")
        case .heartRate: String(localized: "Heart rate")
        case .power: String(localized: "Power")
        case .splits: String(localized: "Splits")
        case .laps: String(localized: "Laps")
        case .bestEfforts: String(localized: "Best efforts")
        case .segments: String(localized: "Segments")
        case .sameRoute: detail.sameRoute?.value?.title ?? String(localized: "Same route")
        case .stats: String(localized: "All stats")
        }
    }
}

/// A stream's full chart with its average above it.
private struct ActivityStreamChartPanel: View {
    let stream: ActivityAnalysis.Stream
    let x: ActivityAnalysis.Axes
    let index: Int
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if let avg = stream.avgText {
                WorkoutStatCell(label: String(localized: "Average"), value: avg, unit: stream.unit)
            }
            ActivityStreamChart(stream: stream, x: x, color: ActivityStreamColor.color(stream.key, index: index, palette: theme.palette), height: .tall)
        }
    }
}
