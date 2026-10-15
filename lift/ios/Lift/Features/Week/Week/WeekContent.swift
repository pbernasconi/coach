import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the week strip pinned on top, the visible week's sessions grouped by day below, the lift sheet and the
/// day picker (SCR-2).
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
            .tabRootHeader { AppHeader("Week") }
            .weekSessionOptions(target: state.optionsTarget, send: send)
            .weekTemplatePickers(state: state, send: send)
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
}
