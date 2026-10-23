import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// The coach's numbers for an exercise (`/api/app/lift/exercises/{key}`): when they are fresh, four stat tiles, the e1RM
/// chart with the touched session, every session's best set and the ten best sets. Each part fails alone. Sessions open
/// the coach's session view.
struct ExerciseServerSections: View {
    /// How many sessions show before "All sessions" folds the rest.
    static let shownSessions = 8

    let stats: LiftExerciseStats
    let freshness: AppFreshness?
    let chart: [ExerciseServerPoint]
    let point: ExerciseServerPoint?
    let isSessionsExpanded: Bool
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            VStack(alignment: .leading, spacing: Space.sm) {
                if let freshness, freshness.isOffline { AppFreshnessLine(freshness: freshness) }
                AppSectionView(nil, section: stats.stats) { tiles in ExerciseStatTiles(tiles: tiles.items) }
            }
            AppSectionView(nil, section: stats.chart) { chart in
                ExerciseServerChart(chart: chart, points: self.chart, point: point, send: send)
            }
            if !(stats.chart.value?.points.isEmpty ?? false) {
                AppSectionView("Sessions", section: stats.sessions) { sessions in
                    ExerciseServerSessions(sessions: sessions.items, isExpanded: isSessionsExpanded, send: send)
                }
            }
            AppSectionView(nil, section: stats.bestSets) { best in ExerciseBestSets(best: best, send: send) }
        }
    }
}

/// The four stats, two to a row (one at accessibility sizes).
private struct ExerciseStatTiles: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let tiles: [LiftStat]

    var body: some View {
        let columns = Array(
            repeating: GridItem(.flexible(), spacing: Space.sm, alignment: .top),
            count: dynamicTypeSize.isAccessibilitySize ? 1 : 2
        )
        LazyVGrid(columns: columns, alignment: .leading, spacing: Space.sm) {
            ForEach(tiles) { tile in
                StatTile(verbatim: tile.label, value: tile.value) {
                    if let detail = tile.detail { ExerciseCaption(text: detail) }
                }
            }
        }
    }
}

/// The coach's e1RM per session. Touching it picks a session; its label and "View session" show under the chart.
private struct ExerciseServerChart: View {
    @Environment(\.koboTheme) private var theme
    let chart: LiftExerciseChart
    let points: [ExerciseServerPoint]
    let point: ExerciseServerPoint?
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader(verbatim: chart.title)
            VStack(alignment: .leading, spacing: Space.sm) {
                if points.isEmpty {
                    SectionState(verbatim: chart.emptyText)
                } else {
                    KoboLineChart(
                        series: [ChartSeries(id: "e1rm", name: chart.title, points: plotted, showsPoints: true)],
                        selection: .action(point?.date) { send(.serverChartSelectionChanged($0)) },
                        xText: ChartFormat.date,
                        verbatimAccessibilityLabel: chart.title
                    )
                    if let point { touched(point) }
                }
                ExerciseCaption(text: chart.caption)
            }
        }
    }

    private var plotted: [ChartPoint<Date>] {
        points.map { ChartPoint(x: $0.date, y: $0.e1rm) }
    }

    private func touched(_ point: ExerciseServerPoint) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            Text(verbatim: point.label)
                .font(theme.font(.footnote).monospacedDigit())
                .foregroundStyle(theme.palette.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("View session") { send(.sessionTapped(point.sessionID)) }
                .buttonStyle(.kobo(.plain, size: .compact, width: .inline))
        }
    }
}

/// Every session with an e1RM, newest first: the day, the best set and its e1RM. The first few show; "All sessions"
/// folds the rest.
private struct ExerciseServerSessions: View {
    let sessions: [LiftExerciseSession]
    let isExpanded: Bool
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            rows(sessions.prefix(ExerciseServerSections.shownSessions))
            if sessions.count > ExerciseServerSections.shownSessions {
                Collapsible(
                    verbatim: String(localized: "All sessions (\(sessions.count))"),
                    isExpanded: .action(isExpanded) { send(.serverSessionsExpandedChanged($0)) }
                ) {
                    rows(sessions.dropFirst(ExerciseServerSections.shownSessions))
                }
            }
        }
    }

    private func rows(_ shown: ArraySlice<LiftExerciseSession>) -> some View {
        ListSection {
            ForEach(shown) { session in
                ListRow(
                    verbatim: session.dateText,
                    subtitle: session.bestSetText,
                    value: session.e1rmText,
                    action: { send(.sessionTapped(session.sessionId)) }
                )
            }
        }
        .listRowDensity(.compact)
    }
}

/// The ten best sets by e1RM.
private struct ExerciseBestSets: View {
    let best: LiftBestSets
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader(verbatim: best.title, subtitle: best.caption)
            ListSection {
                ForEach(best.items) { set in
                    ListRow(
                        verbatim: "\(set.weightText) × \(set.repsText)",
                        subtitle: set.dateText,
                        value: set.e1rmText,
                        action: { send(.sessionTapped(set.sessionId)) }
                    )
                }
            }
            .listRowDensity(.compact)
        }
    }
}

/// A quiet footnote under a stat or a chart.
struct ExerciseCaption: View {
    @Environment(\.koboTheme) private var theme
    let text: String

    var body: some View {
        Text(verbatim: text)
            .font(theme.font(.caption))
            .foregroundStyle(theme.palette.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
