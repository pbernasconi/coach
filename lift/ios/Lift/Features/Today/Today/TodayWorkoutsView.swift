import KoboComponents
import KoboPatterns
import KoboTokens
import LiftSync
import SwiftUI

/// The Garmin sync warning, only when there is one (no date or "synced … ago" line, as on TrainingPeaks).
struct TodaySyncWarning: View {
    let status: GarminStatus?

    var body: some View {
        if let warning = status?.warning {
            InlineNotice(verbatim: warning.text, tone: warning.level == "error" ? .danger : .warning)
        }
    }
}

/// Today's planned workouts as cards: the sport's icon on its colour, the title, the time and length, and Done once
/// done. A lift opens its session, another workout its detail.
struct TodayLineView: View {
    @Environment(\.koboTheme) private var theme
    let line: TodayLine
    let send: (TodayAction) -> Void

    var body: some View {
        VStack(spacing: Space.sm) {
            if line.items.isEmpty {
                HStack(spacing: Space.md) {
                    TodaySportBadge(sport: .rest, isDone: false)
                    Text(verbatim: line.emptyText ?? String(localized: "No workouts for today"))
                        .font(theme.font(.body))
                        .foregroundStyle(theme.palette.textSecondary)
                    Spacer(minLength: 0)
                }
                .koboCard()
            }
            ForEach(line.items) { item in
                Button { send(.lineItemTapped(item.id)) } label: {
                    TodayWorkoutCard(item: item)
                }
                .buttonStyle(.pressFeedback)
            }
        }
    }
}

/// One planned workout on Today.
struct TodayWorkoutCard: View {
    @Environment(\.koboTheme) private var theme
    let item: TodayLineItem

    private var sport: Sport { Sport(rawValue: item.sport) ?? .other }
    private var isDone: Bool { item.state == "done" }

    var body: some View {
        HStack(spacing: Space.md) {
            TodaySportBadge(sport: sport, isDone: isDone)
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: item.title)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .multilineTextAlignment(.leading)
                Text(verbatim: detail)
                    .font(theme.font(.subheadline))
                    .monospacedDigit()
                    .foregroundStyle(theme.palette.textSecondary)
            }
            Spacer(minLength: Space.sm)
            if isDone {
                Label("Done", systemImage: "checkmark.circle.fill")
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.success.ink)
            } else {
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .koboCard()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(verbatim: "\(sport.label): \(item.title)"))
        .accessibilityValue(Text(verbatim: isDone ? "\(detail), done" : detail))
    }

    /// "08:30 · 1:00", without the server's " · done" (the card says Done).
    private var detail: String {
        let suffix = " · done"
        return item.text.hasSuffix(suffix) ? String(item.text.dropLast(suffix.count)) : item.text
    }
}

/// The sport's symbol in white on a rounded square of its colour; dimmed once done.
struct TodaySportBadge: View {
    let sport: Sport
    let isDone: Bool

    var body: some View {
        Image(systemName: sport.symbol)
            .font(.system(size: Size.iconMd, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: Size.minTouch, height: Size.minTouch)
            .background(sport.color.opacity(isDone ? 0.55 : 1), in: RoundedRectangle(cornerRadius: Radius.sm))
            .accessibilityHidden(true)
    }
}
