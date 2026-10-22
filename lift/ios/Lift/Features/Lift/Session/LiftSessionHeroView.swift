import KoboComponents
import KoboTokens
import SwiftUI

/// The top of the session page: the shared workout header (a status pill only before the session is done), the note,
/// then one card with the headline numbers and the muscles worked. No plan totals: the page shows what was done.
struct LiftSessionSummary: View {
    @Environment(\.koboTheme) private var theme
    let hero: LiftSessionHero

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            WorkoutHeader(
                sport: .strength,
                kicker: hero.kicker,
                title: hero.title,
                status: hero.state == "done" ? nil : WorkoutStatus(sessionState: hero.state),
                statusLabel: hero.stateLabel
            ) {
                if let note = hero.note {
                    Text(verbatim: note)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, Space.xxs)
                }
            }
            VStack(alignment: .leading, spacing: Space.md) {
                // Three to a row: six short numbers fit in two rows, so the exercises start higher.
                WorkoutStatGrid(items: hero.summaryStats, id: \.label, columns: 3) { stat in
                    WorkoutStatCell(label: stat.label, value: stat.valueText, unit: stat.unit, size: .compact)
                }
                if let muscles = hero.musclesText {
                    Separator()
                    Label {
                        Text(verbatim: muscles)
                            .fixedSize(horizontal: false, vertical: true)
                    } icon: {
                        Image(systemName: "figure.strengthtraining.traditional")
                            .accessibilityHidden(true)
                    }
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
                    .accessibilityLabel(Text("Sets per muscle: \(muscles)"))
                }
            }
            .koboCard()
        }
    }
}

extension LiftSessionHero {
    /// The headline numbers: the server's summary, else (an older server) the old stats without the plan totals.
    var summaryStats: [ActivityOverview.Stat] {
        if let summary { return summary }
        return stats.filter { !["plannedVolume", "volume"].contains($0.id) }.map {
            ActivityOverview.Stat(label: $0.label, valueText: $0.value, unit: nil)
        }
    }

    /// "Back 8 · Glutes 7 · Quads 6": hard sets per muscle, the most first; nil before any set.
    var musclesText: String? {
        let worked = muscles.prefix(5).filter { $0.setsText != "0" }
        guard !worked.isEmpty else { return nil }
        return worked.map { "\($0.name) \($0.setsText)" }.joined(separator: " · ")
    }
}
