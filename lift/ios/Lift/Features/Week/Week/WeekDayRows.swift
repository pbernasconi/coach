import KoboComponents
import KoboTokens
import SwiftUI

/// One day of the Week list. A day with workouts shows its date ("Today · Wednesday, 21 October") over one card per
/// plan item and Lift session. A free day, or a planned rest day, is one short row with its date and a "+" that plans
/// a workout on it. The selected day's date is in the accent colour.
struct WeekDayRows: View {
    @Environment(\.koboTheme) private var theme
    let day: WeekDaySection
    let send: (WeekAction) -> Void

    var body: some View {
        if workouts.isEmpty {
            freeDay
        } else {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text(verbatim: day.title)
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(day.isToday || day.isSelected ? theme.palette.accentText : theme.palette.textSecondary)
                    .accessibilityAddTraits(.isHeader)
                ForEach(workouts) { entry in
                    switch entry {
                    case .session(let session): WeekSessionRow(session: session, send: send)
                    case .plan(let item): WeekPlanRow(item: item, send: send)
                    }
                }
            }
            .accessibilityAddTraits(day.isSelected ? .isSelected : [])
        }
    }

    /// Everything but planned rest days, which read as a free day.
    private var workouts: [WeekEntry] { day.entries.filter { !$0.isRest } }

    private var isRest: Bool { day.entries.contains(where: \.isRest) }

    private var freeDay: some View {
        Button {
            send(.addWorkoutTapped(day.id))
        } label: {
            HStack(spacing: Space.sm) {
                Text(verbatim: day.title)
                    .font(theme.font(.subheadline))
                    .foregroundStyle(day.isToday || day.isSelected ? theme.palette.accentText : theme.palette.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if isRest {
                    Text("Rest")
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textTertiary)
                }
                Image(systemName: "plus")
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: Size.minTouch - Space.md)
            .koboCard(padding: Space.sm)
        }
        .buttonStyle(.pressFeedback(.scale, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)))
        .accessibilityLabel(Text(verbatim: day.title))
        .accessibilityValue(isRest ? Text("Rest") : Text("Nothing planned"))
        .accessibilityHint(Text("Plans a workout on this day"))
    }
}
