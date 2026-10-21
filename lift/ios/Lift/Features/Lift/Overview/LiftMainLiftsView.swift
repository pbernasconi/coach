import KoboComponents
import KoboTokens
import SwiftUI

/// The most-done lifts of 12 weeks: one card each with the latest e1RM, the change, and the e1RM per session against
/// the best (dashed). A card opens its exercise.
struct LiftMainLiftsView: View {
    let lifts: LiftMainLifts
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            LiftCaption(text: lifts.caption)
            if lifts.items.isEmpty {
                LiftCaption(text: lifts.emptyText)
            }
            ForEach(lifts.items) { lift in
                Button {
                    send(.exerciseTapped(lift.exerciseKey))
                } label: {
                    LiftMainLiftCard(lift: lift)
                }
                .buttonStyle(.pressFeedback)
            }
        }
    }
}

private struct LiftMainLiftCard: View {
    @Environment(\.koboTheme) private var theme
    let lift: LiftMainLift

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                Text(verbatim: lift.name)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if lift.newBest {
                    KoboTag("New best", tone: .success, systemImage: "trophy.fill")
                } else {
                    Text(verbatim: lift.sessionsText)
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                if let e1rm = lift.e1rmText {
                    Text(verbatim: e1rm)
                        .font(theme.font(.title2).monospacedDigit())
                        .foregroundStyle(theme.palette.textPrimary)
                    Text("e1RM")
                        .font(theme.font(.caption).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                }
                if let change = lift.changeText {
                    Text(verbatim: change)
                        .font(theme.font(.subheadline).monospacedDigit())
                        .foregroundStyle(theme.palette.status((lift.change ?? 0) >= 0 ? .success : .danger).ink)
                }
            }
            LiftE1RMChart(lift: lift)
            if let last = lift.lastText { footnote(last) }
            if let best = lift.bestText { footnote(best) }
        }
        .multilineTextAlignment(.leading)
        .koboCard()
    }

    private func footnote(_ text: String) -> some View {
        Text(verbatim: text)
            .font(theme.font(.footnote).monospacedDigit())
            .foregroundStyle(theme.palette.textSecondary)
    }
}

/// The e1RM per session as a compact line, with the best as a dashed reference; the server's text when there are
/// fewer than two sessions.
private struct LiftE1RMChart: View {
    @Environment(\.calendar) private var calendar
    let lift: LiftMainLift

    var body: some View {
        if let empty = lift.chartEmptyText {
            LiftCaption(text: empty)
        } else {
            let points = lift.points.compactMap { point in
                LiftDay.date(point.date, calendar: calendar).map { ChartPoint(x: $0, y: point.e1rm) }
            }
            KoboLineChart(
                series: [ChartSeries(id: "e1rm", name: String(localized: "e1RM"), points: points, showsPoints: true)],
                references: lift.best.map { [ChartReference(y: $0, label: lift.bestText ?? "")] } ?? [],
                height: .compact,
                xText: ChartFormat.date,
                verbatimAccessibilityLabel: String(localized: "\(lift.name) estimated 1RM per session")
            )
        }
    }
}
