import KoboComponents
import KoboTokens
import SwiftUI

/// One session in the week list. A done session shows the accent check disc (the same mark as a logged set) and its
/// logged sets; a planned one shows an open ring and a "…" button that opens the lift sheet. Both rows end in the same
/// 44pt trailing slot (the chevron, or the "…" button over it), so their set counts end on one line.
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
                leading: { WeekRowMark(kind: .done) },
                trailing: {
                    Image(systemName: "chevron.right")
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.textTertiary)
                        .frame(width: Size.minTouch, alignment: .trailing)
                        .accessibilityHidden(true)
                }
            )
            .accessibilityValue(Text("Done"))
        } else {
            ListRow(
                verbatim: session.title,
                subtitle: subtitle,
                value: sets,
                action: { send(.sessionTapped(session.id)) },
                leading: { WeekRowMark(kind: .planned) },
                trailing: { Color.clear.frame(width: Size.minTouch) }
            )
            .overlay(alignment: .trailing) { optionsButton }
        }
    }

    private var subtitle: String { SessionText.exercises(session.exerciseCount) }
    private var sets: String { SessionText.sets(logged: session.loggedSets, total: session.totalSets) }

    /// Sits exactly over the row's reserved trailing slot, outside the row's own button, so the buttons never nest.
    private var optionsButton: some View {
        IconButton(
            "ellipsis",
            verbatimAccessibilityLabel: String(localized: "Options for \(session.title)"),
            style: .plain,
            size: .small
        ) {
            send(.sessionOptionsTapped(session.id))
        }
        .frame(width: Size.minTouch)
        .padding(.trailing, Space.gutter)
    }
}

/// The leading mark of a week row: the accent disc with a check once done (a fill, so the bright accent), an open
/// ring while planned, and a dashed ring on a day with nothing planned. Decorative; the row says the rest.
struct WeekRowMark: View {
    enum Kind { case done, planned, empty }

    @Environment(\.koboTheme) private var theme
    let kind: Kind

    var body: some View {
        Group {
            switch kind {
            case .done:
                Image(systemName: "checkmark.circle.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(theme.palette.onAccent, theme.palette.accent)
            case .planned:
                Image(systemName: "circle")
                    .foregroundStyle(theme.palette.textTertiary)
            case .empty:
                Image(systemName: "circle.dashed")
                    .foregroundStyle(theme.palette.textTertiary)
            }
        }
        .font(theme.font(.body))
        .accessibilityHidden(true)
    }
}
