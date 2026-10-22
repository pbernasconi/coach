import KoboComponents
import KoboTokens
import SwiftUI

/// One Lift session as a Week card: its title, then the strength icon with its exercises and sets. A done session is
/// a green card with a "Done" check, as on the web; a planned one a dashed outline. A long press on a planned one
/// opens the lift sheet (move, push to next week, change, remove). A tap opens the workout.
struct WeekSessionRow: View {
    @Environment(\.koboTheme) private var theme
    let session: SessionSummary
    let send: (WeekAction) -> Void

    var body: some View {
        WeekCard(
            status: session.isDone ? .done : .planned,
            sport: Sport.strength.color,
            action: { send(.sessionTapped(session.id)) }
        ) {
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                Text(verbatim: session.title)
                    .font(theme.font(.body).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                WeekStatusMark(status: session.isDone ? .done : .planned, label: String(localized: "Done"))
            }
            HStack(spacing: Space.sm) {
                Sport.strength.icon
                    .font(theme.font(.title2))
                    .frame(width: Size.iconLg + Space.sm, alignment: .leading)
                Text(verbatim: SessionText.exercises(session.exerciseCount))
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(verbatim: SessionText.sets(logged: session.loggedSets, total: session.totalSets))
                    .font(theme.font(.headline).monospacedDigit())
                    .foregroundStyle(theme.palette.textPrimary)
            }
        }
        .accessibilityElement(children: .combine)
        .contextMenu {
            if !session.isDone {
                Button("Reschedule", systemImage: "calendar") { send(.sessionOptionsTapped(session.id)) }
            }
        }
    }
}
