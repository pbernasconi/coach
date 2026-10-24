import KoboComponents
import KoboTokens
import SwiftUI

/// One day of the Week list: its date ("Today · Wednesday, 21 October") over one card holding a row per plan item and
/// Lift session. A free day, or a planned rest day, has a short dashed slot instead that plans a workout on it. Today's
/// date is in the brand's text colour, the selected day's in ink. A workout not done yet can be long-pressed and dropped
/// on another day; the day under it shows an outline in the brand colour.
struct WeekDayRows: View {
    @Environment(\.koboTheme) private var theme
    let day: WeekDaySection
    let send: (WeekAction) -> Void
    /// A dragged row is held over this day (presentation state only).
    @State private var isTargeted = false

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(verbatim: day.title)
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(titleColor)
                .padding(.leading, Space.xxs)
                .accessibilityAddTraits(.isHeader)
            if workouts.isEmpty {
                emptySlot
            } else {
                WeekDayGroup(statuses: workouts.map(\.cardStatus)) {
                    ForEach(Array(workouts.enumerated()), id: \.element.id) { index, entry in
                        row(entry)
                            .overlay(alignment: .top) {
                                if index > 0 { WeekRowDivider() }
                            }
                    }
                }
            }
        }
        .padding(Space.xxs)
        .background {
            RoundedRectangle(cornerRadius: Radius.md + Space.xxs, style: .continuous)
                .strokeBorder(theme.palette.accent, lineWidth: Size.hairline * 4)
                .opacity(isTargeted ? 1 : 0)
        }
        .padding(-Space.xxs)
        .weekDropTarget(day.id, isTargeted: { isTargeted = $0 }, send: send)
        .koboAnimation(.fastSpatial, value: isTargeted)
        .accessibilityAddTraits(day.isSelected ? .isSelected : [])
    }

    @ViewBuilder private func row(_ entry: WeekEntry) -> some View {
        switch entry {
        case .session(let session):
            WeekSessionRow(session: session, send: send).weekDraggable(WeekDrag(entry, on: day.id))
        case .plan(let item):
            WeekPlanRow(item: item, send: send).weekDraggable(WeekDrag(entry, on: day.id))
        }
    }

    private var titleColor: Color {
        if day.isToday { return theme.palette.accentText }
        return day.isSelected ? theme.palette.textPrimary : theme.palette.textSecondary
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
