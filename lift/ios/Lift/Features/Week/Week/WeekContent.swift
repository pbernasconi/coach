import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the header with Plan next week and Add workout, the week strip pinned under it, the visible week's days
/// below, the lift sheet, the day picker and the plan item sheet (SCR-2).
struct WeekContent: View {
    let state: WeekState
    let send: (WeekAction) -> Void

    var body: some View {
        WeekSessionList(state: state, send: send)
            .safeAreaInset(edge: .top, spacing: 0) {
                if let strip = state.strip {
                    WeekStripBar(strip: strip, weekOffset: state.weekOffset, send: send)
                }
            }
            .screenCanvas()
            .tabRootHeader { header }
            .weekSessionOptions(target: state.optionsTarget, send: send)
            .weekTemplatePickers(state: state, send: send)
            .weekPlanItemSheet(item: state.planItemTarget, send: send)
            .koboSheet(
                item: .action(state.moveTarget) { if $0 == nil { send(.destinationDismissed) } },
                title: { String(localized: "Move \($0.title)") },
                subtitle: { $0.dayTitle }
            ) { move in
                WeekMovePicker(
                    move: move,
                    today: state.strip?.today ?? move.current,
                    markers: state.strip?.dayItems ?? [],
                    send: send
                )
            }
    }

    /// Plan next week copies the visible week's template days a week forward, with Undo in a toast; it is off while the
    /// week has none. Add workout plans the selected day.
    private var header: some View {
        AppHeader("Week") {
            Button("Plan next week", systemImage: "calendar.badge.plus") { send(.planNextWeekTapped) }
                .disabled(!state.canPlanNextWeek)
            Button("Add workout", systemImage: "plus") { send(.addWorkoutTapped(nil)) }
        }
    }
}
