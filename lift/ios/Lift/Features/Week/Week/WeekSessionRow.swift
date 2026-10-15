import KoboComponents
import KoboTokens
import SwiftUI

/// One session in the week list. A done session shows a filled check and its logged sets; a planned one shows an
/// open circle and a "…" button that opens the lift sheet.
struct WeekSessionRow: View {
    @Environment(\.koboTheme) private var theme
    let session: SessionSummary
    let send: (WeekAction) -> Void

    var body: some View {
        if session.isDone {
            ListRow(
                verbatim: session.title,
                subtitle: subtitle,
                value: sets,
                action: { send(.sessionTapped(session.id)) },
                leading: { status(symbol: "checkmark.circle.fill", color: theme.palette.success.ink) }
            )
            .accessibilityValue(Text("Done"))
        } else {
            ListRow(
                verbatim: session.title,
                subtitle: subtitle,
                value: sets,
                action: { send(.sessionTapped(session.id)) },
                leading: { status(symbol: "circle", color: theme.palette.accentText) },
                trailing: { Color.clear.frame(width: Size.minTouch) }
            )
            .overlay(alignment: .trailing) { optionsButton }
        }
    }

    private var subtitle: String { SessionText.exercises(session.exerciseCount) }
    private var sets: String { SessionText.sets(logged: session.loggedSets, total: session.totalSets) }

    private func status(symbol: String, color: Color) -> some View {
        Image(systemName: symbol)
            .foregroundStyle(color)
            .accessibilityHidden(true)
    }

    /// Sits over the row's reserved trailing space, outside the row's own button, so the buttons never nest.
    private var optionsButton: some View {
        IconButton(
            "ellipsis",
            verbatimAccessibilityLabel: String(localized: "Options for \(session.title)"),
            style: .plain,
            size: .small
        ) {
            send(.sessionOptionsTapped(session.id))
        }
        .padding(.trailing, Space.xs)
    }
}
