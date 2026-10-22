import KoboComponents
import KoboTokens
import SwiftUI

/// One day of the Week list: its date ("Today · Wednesday, 21 October") over one card per plan item and Lift session.
/// A free day, or a planned rest day, has a short dashed slot instead that plans a workout on it. Today's and the
/// selected day's date are in ink.
struct WeekDayRows: View {
    @Environment(\.koboTheme) private var theme
    let day: WeekDaySection
    let send: (WeekAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            Text(verbatim: day.title)
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(day.isToday || day.isSelected ? theme.palette.textPrimary : theme.palette.textSecondary)
                .accessibilityAddTraits(.isHeader)
            if workouts.isEmpty {
                emptySlot
            }
            ForEach(workouts) { entry in
                switch entry {
                case .session(let session): WeekSessionRow(session: session, send: send)
                case .plan(let item): WeekPlanRow(item: item, send: send)
                }
            }
        }
        .accessibilityAddTraits(day.isSelected ? .isSelected : [])
    }

    /// Everything but planned rest days, which read as a free day.
    private var workouts: [WeekEntry] { day.entries.filter { !$0.isRest } }

    private var isRest: Bool { day.entries.contains(where: \.isRest) }

    /// A free day's slot: a short dashed outline with "+" (and "Rest" on a planned rest day) that plans a workout.
    private var emptySlot: some View {
        Button {
            send(.addWorkoutTapped(day.id))
        } label: {
            HStack(spacing: Space.xs) {
                Image(systemName: "plus").accessibilityHidden(true)
                Text(isRest ? "Rest" : "Add workout")
            }
            .font(theme.font(.subheadline))
            .foregroundStyle(theme.palette.textTertiary)
            .frame(maxWidth: .infinity, minHeight: Size.minTouch)
            .background {
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .strokeBorder(
                        theme.palette.separator,
                        style: StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xs, Space.xs])
                    )
            }
            .contentShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        }
        .buttonStyle(.pressFeedback(.scale, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous)))
        .accessibilityLabel(Text(isRest ? "Rest" : "Nothing planned"))
        .accessibilityHint(Text("Plans a workout on this day"))
    }
}
