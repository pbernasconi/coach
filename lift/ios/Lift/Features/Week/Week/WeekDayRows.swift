import KoboComponents
import KoboTokens
import SwiftUI

/// One day of the week list: the date badge beside each of its rows (plan items and Lift sessions), or beside "Rest"
/// when it has none. A day with two rows shows the badge once. With the coach plan on, each row also shows its sport
/// icon. The selected day's rows sit on the accent tint.
struct WeekDayRows: View {
    @Environment(\.koboTheme) private var theme
    let day: WeekDaySection
    /// Whether the coach plan is on: rows then show their sport icon.
    let showsSports: Bool
    let send: (WeekAction) -> Void

    var body: some View {
        Group {
            if day.entries.isEmpty {
                restRow
            }
            ForEach(Array(day.entries.enumerated()), id: \.element.id) { index, entry in
                switch entry {
                case .session(let session):
                    WeekSessionRow(session: session, send: send) {
                        WeekRowLeading(day: day, isFirst: index == 0, sport: showsSports ? .strength : nil)
                    }
                case .plan(let item):
                    WeekPlanRow(item: item, send: send) {
                        WeekRowLeading(day: day, isFirst: index == 0, sport: item.sport)
                    }
                }
            }
        }
        .background(day.isSelected ? theme.palette.accentSoft : .clear)
        .accessibilityAddTraits(day.isSelected ? .isSelected : [])
    }

    /// A day with nothing planned. Tapping it selects the day, so Add workout in the header plans it.
    private var restRow: some View {
        ListRow(
            "Rest",
            action: { send(.dayTapped(day.id)) },
            leading: { WeekDateBadge(day: day) },
            trailing: {
                Image(systemName: "moon.zzz")
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textTertiary)
                    .frame(width: Size.minTouch)
                    .accessibilityHidden(true)
            }
        )
        .listRowEmphasis(.quiet)
    }
}

/// The date at the start of a Week row: "Mon" over "19". Today's number sits on the accent disc, as in the strip.
struct WeekDateBadge: View {
    @Environment(\.koboTheme) private var theme
    let day: WeekDaySection

    var body: some View {
        VStack(spacing: Space.xxs) {
            Text(verbatim: day.weekday)
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(day.isToday ? theme.palette.accentText : theme.palette.textSecondary)
            Text(verbatim: day.dayNumber)
                .font(theme.font(.headline).monospacedDigit())
                .foregroundStyle(day.isToday ? theme.palette.onAccent : theme.palette.textPrimary)
                .frame(minWidth: Size.iconLg + Space.md, minHeight: Size.iconLg + Space.md)
                .background {
                    // A fill, so the bright accent; the number on it uses onAccent.
                    if day.isToday { Circle().fill(theme.palette.accent) }
                }
        }
        .frame(minWidth: Size.minTouch)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: day.title))
    }
}
