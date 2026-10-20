import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// One coach plan item in the week list, after the day's date badge (`leading`): its title, the server's subtitle and
/// a state pill with the server's label. Done items read quieter; skipped ones are struck through. A tap opens the
/// read-only detail sheet.
struct WeekPlanRow<Leading: View>: View {
    let item: WeekPlanItem
    let send: (WeekAction) -> Void
    @ViewBuilder let leading: () -> Leading

    var body: some View {
        ListRow(
            verbatim: item.title,
            subtitle: item.rowSubtitle,
            action: { send(.planItemTapped(item.id)) },
            leading: leading,
            trailing: { WeekPlanStatePill(item: item).fixedSize() }
        )
        .strikethrough(item.state == .skipped)
        .listRowEmphasis(isQuiet ? .quiet : .standard)
    }

    private var isQuiet: Bool {
        item.state == .done || item.state == .skipped || item.sport == .rest
    }
}

/// The server's state label in a toned pill: a glyph and a word, never colour alone.
struct WeekPlanStatePill: View {
    let item: WeekPlanItem

    var body: some View {
        if !item.stateLabel.isEmpty {
            StatusPill(verbatim: item.stateLabel, tone: tone, symbol: symbol)
        }
    }

    private var tone: Tone {
        switch item.state {
        case .done: .success
        case .today: .accent
        case .missed: .danger
        case .planned, .skipped: .neutral
        }
    }

    private var symbol: String {
        switch item.state {
        case .done: "checkmark.circle.fill"
        case .today: "clock.fill"
        case .missed: "exclamationmark.circle.fill"
        case .skipped: "forward.fill"
        case .planned: item.sport == .rest ? "moon.zzz.fill" : "circle"
        }
    }
}

/// The start of a Week row: the date badge (shown on a day's first row only) and, when the plan is on, the row's sport
/// icon in the sport's colour.
struct WeekRowLeading: View {
    @Environment(\.koboTheme) private var theme
    let day: WeekDaySection
    let isFirst: Bool
    /// Nil when sync is off: the row starts with the badge alone, as before the plan.
    let sport: Sport?

    var body: some View {
        HStack(spacing: Space.md) {
            WeekDateBadge(day: day).opacity(isFirst ? 1 : 0).accessibilityHidden(!isFirst)
            if let sport {
                sport.icon
                    .font(theme.font(.headline))
                    .frame(width: Size.iconLg)
            }
        }
    }
}
