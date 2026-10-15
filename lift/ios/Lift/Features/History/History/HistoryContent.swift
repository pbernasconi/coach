import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: past sessions grouped by week, newest first (SCR-2).
struct HistoryContent: View {
    let state: HistoryState
    let send: (HistoryAction) -> Void

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Space.xxl) {
                switch state.weeks {
                case .loading:
                    LoadingState()
                case .empty:
                    EmptyState(
                        symbol: "clock.arrow.circlepath",
                        title: "No past workouts",
                        message: "Workouts from the last 8 weeks show here once they are logged."
                    )
                case .failed:
                    ErrorState(title: "History could not be loaded")
                case .loaded(let weeks):
                    ForEach(weeks) { week in
                        HistoryWeekSection(week: week, send: send)
                    }
                }
            }
            .pageGutter()
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .tabRootHeader { AppHeader("History") }
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
                    subtitle: "\(session.dayTitle) · \(SessionText.exercises(session.summary.exerciseCount))",
                    value: SessionText.sets(logged: session.summary.loggedSets, total: session.summary.totalSets),
                    action: { send(.sessionTapped(session.id)) }
                )
            }
        }
    }
}
