import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Lift on Trends: hard sets per muscle this week against the 10–20 band (the tick is the 4-week average), and the
/// main lifts' e1RM.
struct TrendsLiftSection: View {
    let lift: TrendsLift
    let send: (TrainingAction) -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if let empty = lift.emptyText, !lift.hasData {
                SectionState(verbatim: empty)
            }
            if let muscles = lift.muscles {
                muscleRows(muscles)
            }
            if !lift.mainLifts.isEmpty {
                ListSection(verbatim: String(localized: "Main lifts · e1RM")) {
                    ForEach(lift.mainLifts, id: \.exerciseKey) { item in mainLift(item) }
                }
            }
        }
    }

    private func muscleRows(_ muscles: TrendsLift.Muscles) -> some View {
        let band = min(muscles.band.min, muscles.band.max)...max(muscles.band.min, muscles.band.max)
        let scale = max(muscles.band.max * 1.25, muscles.rows.map { max($0.week, $0.avg) }.max() ?? 0)
        return VStack(alignment: .leading, spacing: Space.md) {
            ForEach(muscles.rows, id: \.muscle) { row in
                VStack(alignment: .leading, spacing: Space.xs) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(verbatim: row.label).font(theme.font(.subheadline).weight(.semibold))
                        Spacer(minLength: Space.sm)
                        Text(verbatim: "\(row.weekText) · \(row.statusText)")
                            .font(theme.font(.subheadline).monospacedDigit())
                            .foregroundStyle(
                                row.status == "inRange" ? theme.palette.textPrimary : theme.palette.textSecondary
                            )
                    }
                    BandBar(value: row.week, scaleMax: scale, band: band, tick: row.avg)
                }
                .accessibilityElement(children: .combine)
            }
            if let note = muscles.note {
                Text(verbatim: note).font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
            }
        }
    }

    private func mainLift(_ item: AppMainLift) -> some View {
        let tone = item.tone?.kobo
        let value = [item.latestText, item.changeText].compactMap(\.self).filter { !$0.isEmpty }.joined(
            separator: " · "
        )
        return ListRow(
            verbatim: item.name,
            subtitle: item.sparkText,
            value: value,
            action: {
                send(.mainLiftTapped(item.exerciseKey))
            }
        ) {
            if item.points.count > 1 {
                Sparkline(
                    values: item.points.map(\.e1rm),
                    color: tone.map { theme.palette.status($0).ink },
                    verbatimAccessibilityLabel: item.name
                )
                .frame(width: Size.thumbnail)
            }
        }
    }
}
