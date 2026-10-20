import KoboComponents
import KoboTokens
import SwiftUI

/// One session in the week list, after the day's date badge (`leading`). A done session ends in the accent check disc
/// (the same mark as a logged set) and reads quieter; a planned one ends in a "…" button that opens the lift sheet.
/// Both end in the same 44pt trailing slot, so their set counts end on one line.
struct WeekSessionRow<Leading: View>: View {
    @Environment(\.koboTheme) private var theme
    let session: SessionSummary
    let send: (WeekAction) -> Void
    @ViewBuilder let leading: () -> Leading

    var body: some View {
        if session.isDone {
            ListRow(
                verbatim: session.title,
                subtitle: subtitle,
                value: sets,
                action: { send(.sessionTapped(session.id)) },
                leading: leading,
                trailing: {
                    Image(systemName: "checkmark.circle.fill")
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(theme.palette.onAccent, theme.palette.accent)
                        .font(theme.font(.title2))
                        .frame(width: Size.minTouch)
                        .accessibilityHidden(true)
                }
            )
            .listRowEmphasis(.quiet)
            .accessibilityValue(Text("Done"))
        } else {
            ListRow(
                verbatim: session.title,
                subtitle: subtitle,
                value: sets,
                action: { send(.sessionTapped(session.id)) },
                leading: leading,
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
