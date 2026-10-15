import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Sizes of the History page.
enum HistoryMetrics {
    /// The largest text size of the Sessions | Progress picker: past it the two segments would stack and push the page
    /// down; at this size they still read clearly side by side.
    static let pickerTypeSize = DynamicTypeSize.xxxLarge
}

/// Dumb view: past sessions grouped by week, newest first, or (Progress) hard sets per muscle and per week (SCR-2).
struct HistoryContent: View {
    let state: HistoryState
    let send: (HistoryAction) -> Void

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Space.section) {
                SegmentedPicker(
                    "History view",
                    selection: .action(state.segment) { send(.segmentChanged($0)) },
                    options: [
                        ChoiceOption(HistorySegment.sessions, title: "Sessions"),
                        ChoiceOption(HistorySegment.progress, title: "Progress"),
                    ]
                )
                .dynamicTypeSize(...HistoryMetrics.pickerTypeSize)
                switch state.segment {
                case .sessions: HistorySessions(weeks: state.weeks, send: send)
                case .progress: HistoryProgress(volume: state.volume, send: send)
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .tabRootHeader {
            AppHeader("History") {
                Button("Import from Notes", systemImage: "square.and.arrow.down") { send(.importTapped) }
            }
        }
        .koboSheet(
            item: Binding<MuscleDetail?>.action(state.muscleDetail) { if $0 == nil { send(.muscleDetailDismissed) } },
            title: \.title,
            subtitle: { $0.subtitle },
            detents: [.medium, .large]
        ) { detail in
            MuscleDetailList(detail: detail)
        }
    }
}

/// Past sessions by week.
private struct HistorySessions: View {
    let weeks: Loadable<[HistoryWeek]>
    let send: (HistoryAction) -> Void

    var body: some View {
        switch weeks {
        case .loading:
            LoadingState()
        case .empty:
            EmptyState(
                symbol: "clock.arrow.circlepath",
                title: "No past workouts",
                message:
                    "A workout shows here once a set is logged or it is finished. Logged in Apple Notes? Import it."
            ) {
                Button("Import from Notes", systemImage: "square.and.arrow.down") { send(.importTapped) }
                    .buttonStyle(.kobo(.secondary))
            }
        case .failed:
            ErrorState(title: "History could not be loaded")
        case .loaded(let weeks):
            ForEach(weeks) { week in
                HistoryWeekSection(week: week, send: send)
            }
        }
    }
}

/// Training volume: the 8-week trend, which picks a week, then that week's hard sets per muscle.
private struct HistoryProgress: View {
    let volume: Loadable<VolumeProgress>
    let send: (HistoryAction) -> Void

    var body: some View {
        switch volume {
        case .loading:
            LoadingState()
        case .empty:
            EmptyState(
                symbol: "chart.bar.xaxis",
                title: "No logged sets",
                message: "Hard sets per muscle show here once you log sets in the last 8 weeks."
            )
        case .failed:
            ErrorState(title: "Progress could not be loaded")
        case .loaded(let progress):
            VolumeTrendSection(progress: progress, send: send)
            MuscleVolumeSection(progress: progress, send: send)
        }
    }
}

/// One week of past sessions.
private struct HistoryWeekSection: View {
    let week: HistoryWeek
    let send: (HistoryAction) -> Void

    var body: some View {
        ListSection(verbatim: week.title) {
            ForEach(week.sessions) { session in
                ListRow(
                    verbatim: session.summary.title,
                    subtitle: subtitle(session),
                    value: SessionText.sets(logged: session.summary.loggedSets, total: session.summary.totalSets),
                    action: { send(.sessionTapped(session.id)) }
                )
            }
        }
    }

    /// "Tue, Oct 13 · 5 exercises", with the first line of the session's note under it when there is one.
    private func subtitle(_ session: HistorySession) -> String {
        let line = "\(session.dayTitle) · \(SessionText.exercises(session.summary.exerciseCount))"
        return [line, session.summary.note].compactMap(\.self).joined(separator: "\n")
    }
}

/// The exercises behind a muscle's sets that week, most first.
private struct MuscleDetailList: View {
    let detail: MuscleDetail

    var body: some View {
        ListSection {
            if detail.rows.isEmpty {
                ListRow("No sets for this muscle that week")
            } else {
                ForEach(detail.rows) { row in
                    ListRow(verbatim: row.name, subtitle: row.detail, value: row.value)
                }
            }
        }
    }
}
