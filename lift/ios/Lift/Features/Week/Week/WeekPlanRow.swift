import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// One coach plan item as a Week card, styled by its status as on the web (`WeekCard`): its title and status mark, then
/// the sport icon with its time, distance and TSS, then the workout's interval bars in one quiet colour when it has
/// steps. Skipped items are struck through. A tap opens the read-only detail sheet, or the Lift session it plans.
struct WeekPlanRow: View {
    @Environment(\.koboTheme) private var theme
    let item: WeekPlanItem
    let send: (WeekAction) -> Void

    var body: some View {
        WeekCard(status: item.cardStatus, sport: item.sport.color, action: { send(.planItemTapped(item.id)) }) {
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                Text(verbatim: item.title)
                    .font(theme.font(.callout).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .strikethrough(item.state == .skipped)
                    .frame(maxWidth: .infinity, alignment: .leading)
                WeekStatusMark(status: item.cardStatus, label: item.stateLabel)
            }
            HStack(spacing: Space.sm) {
                item.sport.icon
                    .font(theme.font(.title2))
                    .frame(width: Size.iconLg + Space.sm, alignment: .leading)
                stat(item.stats.time, unit: nil)
                if item.hasDistance { stat(item.stats.distance, unit: "km") }
                stat(item.stats.tss, unit: "TSS")
            }
            if !item.profile.isEmpty {
                // Close to the card's bottom edge: most of the card's bottom padding goes under the bars.
                ProfileStrip(
                    segments: item.profile,
                    color: theme.palette.textTertiary,
                    height: Space.md,
                    accessibilityLabel: "Intervals"
                )
                .padding(.bottom, -(Space.sm - Space.xxs))
            }
        }
        // One element: "Ride: Sweet spot 3 × 12", then "1:00:00, 30.0 km, 70 TSS, Today".
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(verbatim: "\(item.sport.label): \(item.title)"))
        .accessibilityValue(Text(verbatim: spoken))
        .accessibilityHint(
            item.liftSessionId == nil ? Text("Shows the workout's details") : Text("Opens the Lift session")
        )
    }

    private func stat(_ text: String?, unit: String?) -> some View {
        let (value, unit) = WeekStat.split(text, unit: unit)
        return WeekStat(text: value, unit: unit)
    }

    private var spoken: String {
        let tss = item.stats.tss.map { "\($0) TSS" }
        let parts = [item.stats.time, item.stats.distance, tss, item.state == .planned ? nil : item.stateLabel]
        return parts.compactMap(\.self).filter { !$0.isEmpty }.joined(separator: ", ")
    }
}

/// The server's state label in a toned pill: a glyph and a word, never colour alone. None while planned: being on the
/// list says it is planned.
struct WeekPlanStatePill: View {
    let item: WeekPlanItem

    var body: some View {
        if !item.stateLabel.isEmpty && item.state != .planned {
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
