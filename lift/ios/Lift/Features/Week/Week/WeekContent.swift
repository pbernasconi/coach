import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the week strip, then the selected day's sessions (SCR-2).
struct WeekContent: View {
    let state: WeekState
    let send: (WeekAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xl) {
                if let strip = state.strip {
                    DayStrip(
                        items: strip.days.map { dayItem($0) },
                        today: strip.today,
                        week: .action(state.weekOffset) { send(.weekChanged($0)) },
                        weeks: WeekState.weeks,
                        selection: strip.selected,
                        onSelect: { send(.daySelected($0)) }
                    )
                    .padding(.vertical, Space.md)
                    .koboCard(padding: 0)
                }
                WeekSessionList(state: state, send: send)
            }
            .pageGutter()
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .tabRootHeader { AppHeader("Week") }
    }

    private func dayItem(_ day: WeekDay) -> DayItem {
        switch day.status {
        case .planned: DayItem(date: day.date, marker: .planned(.accent))
        case .done: DayItem(date: day.date, marker: .done(.accent))
        }
    }
}

/// The selected day's sessions, or why there are none.
private struct WeekSessionList: View {
    let state: WeekState
    let send: (WeekAction) -> Void

    var body: some View {
        switch state.sessions {
        case .loading:
            LoadingState()
        case .empty:
            EmptyState(symbol: "calendar", title: "No workouts", message: "Nothing is planned for this day.")
        case .failed:
            ErrorState(title: "Workouts could not be loaded")
        case .loaded(let sessions):
            ListSection(verbatim: state.strip?.title ?? "") {
                ForEach(sessions) { session in
                    ListRow(
                        verbatim: session.title,
                        subtitle: SessionText.exercises(session.exerciseCount),
                        value: SessionText.sets(logged: session.loggedSets, total: session.totalSets),
                        action: { send(.sessionTapped(session.id)) }
                    )
                }
            }
        }
    }
}
