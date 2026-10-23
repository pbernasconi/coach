import KoboComponents
import KoboPatterns
import KoboTokens
import LiftSync
import SwiftUI

/// The newest weigh-in with its trend and 4-week change, then the newest DEXA scan's measures as tiles, each change
/// toned and with its own arrow.
struct TodayBodyView: View {
    @Environment(\.koboTheme) private var theme
    let reading: HealthBody

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if let weight = reading.weight {
                StatTile(verbatim: String(localized: "Weight"), value: weight.valueText, unit: weight.unit) {
                    Text(verbatim: weightLine(weight))
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if let dexa = reading.dexa, !dexa.measures.isEmpty {
                VStack(alignment: .leading, spacing: Space.sm) {
                    Text(verbatim: String(localized: "DEXA · \(dexa.dateText)"))
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                    TileGrid(dexa.measures) { measure in
                        StatTile(
                            verbatim: measure.label,
                            value: measure.valueText,
                            unit: measure.unit,
                            delta: measure.changeText.map { .textOnly(verbatim: $0, tone: measure.tone?.kobo ?? .neutral) }
                        )
                    }
                }
            }
            if reading.weight == nil && (reading.dexa?.measures.isEmpty ?? true) {
                SectionEmptyCard("No weight or DEXA scan yet", systemImage: "scalemass")
            }
        }
    }

    /// "Oct 20 · trend 81.0 · ▼ 0.12/wk · ▼ 0.5 kg in 4 weeks".
    private func weightLine(_ weight: HealthWeight) -> String {
        [weight.dateText, weight.trendText, weight.change4wText].compactMap(\.self).joined(separator: " · ")
    }
}
