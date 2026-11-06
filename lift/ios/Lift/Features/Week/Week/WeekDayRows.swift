import KoboComponents
import KoboTokens
import SwiftUI

/// One day of the Week list: its date ("Today · Wednesday, 21 October") over one card holding a row per plan item and
/// Lift session. A planned rest day gets its own compact row under the date: a moon and "Rest day" on a soft fill, and
/// a small "+" that plans a workout on it (no card border: rest is not something to complete). A free day has a short
/// dashed slot instead. Today's
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
            header
            if let restTitle { restRow(restTitle) }
            if workouts.isEmpty {
                if !isRest { emptySlot }
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

    /// The date.
    private var header: some View {
        Text(verbatim: day.title)
            .font(theme.font(.footnote).weight(.semibold))
            .foregroundStyle(titleColor)
            .accessibilityAddTraits(.isHeader)
            .padding(.leading, Space.xxs)
    }

    /// A rest day's own row: the moon and the title on a soft fill, one touch target tall so the week still shows
    /// 5-6 workouts per screen. On a day with nothing else, a "+" at the end plans a workout there.
    private func restRow(_ title: String) -> some View {
        HStack(spacing: Space.sm) {
            Image(systemName: Sport.rest.symbol)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(width: Size.iconLg)
                .accessibilityHidden(true)
            Text(verbatim: title)
                .font(theme.font(.subheadline).weight(.medium))
                .foregroundStyle(theme.palette.textSecondary)
                .lineLimit(1)
            Spacer(minLength: 0)
            if workouts.isEmpty { addOnRestDay }
        }
        .padding(.leading, Space.md)
        .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(theme.palette.surface)
        }
        .accessibilityElement(children: .contain)
    }

    /// The rest item's title ("Rest day", "Rest · travel"), nil on a day without one.
    private var restTitle: String? {
        guard case .plan(let item)? = day.entries.first(where: \.isRest) else { return nil }
        let title = item.title.trimmingCharacters(in: .whitespaces)
        return title.isEmpty || title == "Rest" ? String(localized: "Rest day") : title
    }

    /// A small "+" at the end of a rest day's row: planning a workout there is possible, but not the point of the day.
    private var addOnRestDay: some View {
        Button {
            send(.addWorkoutTapped(day.id))
        } label: {
            Image(systemName: "plus")
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textTertiary)
                .frame(width: Size.minTouch, height: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback(.scale, in: Circle()))
        .accessibilityLabel(Text("Add workout"))
        .accessibilityHint(Text("Plans a workout on this rest day"))
    }

    private var titleColor: Color {
        if day.isToday { return theme.palette.accentText }
        return day.isSelected ? theme.palette.textPrimary : theme.palette.textSecondary
    }

    /// Everything but planned rest days, which read as a free day.
    private var workouts: [WeekEntry] { day.entries.filter { !$0.isRest } }

    private var isRest: Bool { day.entries.contains(where: \.isRest) }

    /// A free day's slot: a short dashed outline with "+" that plans a workout.
    private var emptySlot: some View {
        Button {
            send(.addWorkoutTapped(day.id))
        } label: {
            HStack(spacing: Space.xs) {
                Image(systemName: "plus").accessibilityHidden(true)
                Text("Add workout")
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
        .accessibilityLabel(Text("Nothing planned"))
        .accessibilityHint(Text("Plans a workout on this day"))
    }
}
