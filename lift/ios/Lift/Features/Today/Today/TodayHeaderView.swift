import KoboComponents
import KoboPatterns
import KoboTokens
import LiftSync
import SwiftUI

/// The date, then the Garmin line as a quiet footnote: when it synced and last night's sleep (amber when the watch
/// missed the night, with its words), and a sync warning when there is one.
struct TodayHeaderView: View {
    @Environment(\.koboTheme) private var theme
    let dateText: String?
    let status: GarminStatus?

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            if let dateText {
                Text(verbatim: dateText)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textSecondary)
                    .accessibilityAddTraits(.isHeader)
            }
            if let status {
                garminLine(status)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
                if let warning = status.warning {
                    InlineNotice(verbatim: warning.text, tone: warning.level == "error" ? .danger : .warning)
                        .padding(.top, Space.xs)
                }
            }
        }
    }

    /// "Garmin: synced 2 h ago, through Oct 20 · last night 6:42 asleep".
    private func garminLine(_ status: GarminStatus) -> Text {
        let line = Text(verbatim: status.text)
        guard let night = status.nightText else { return line }
        let nightText = Text(verbatim: night)
            .foregroundStyle(status.nightIn ? theme.palette.textTertiary : theme.palette.warning.ink)
        return Text("\(line) · \(nightText)")
    }
}

/// Today's planned workouts: a lift opens its session, another workout its detail.
struct TodayLineView: View {
    @Environment(\.koboTheme) private var theme
    let line: TodayLine
    let send: (TodayAction) -> Void

    var body: some View {
        ListSection {
            if line.items.isEmpty {
                ListRow(verbatim: line.emptyText ?? String(localized: "Nothing planned")) {
                    Sport.rest.icon.font(theme.font(.headline)).frame(width: Size.iconLg)
                }
                .listRowEmphasis(.quiet)
            }
            ForEach(line.items) { item in
                let sport = Sport(rawValue: item.sport) ?? .other
                ListRow(verbatim: item.title, subtitle: item.text, action: { send(.lineItemTapped(item.id)) }) {
                    sport.icon.font(theme.font(.headline)).frame(width: Size.iconLg)
                }
                .accessibilityLabel(Text(verbatim: "\(sport.label): \(item.title)"))
                .accessibilityValue(Text(verbatim: item.text))
            }
        }
    }
}
