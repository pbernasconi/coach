import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The vitals, two to a row: each the latest value, its range bar and its foot ("normal 48–56"). An outlier is red
/// with "Low" or "High" beside it, never colour alone; a value older than yesterday names its day in amber.
struct TodayVitalsView: View {
    @Environment(\.koboTheme) private var theme
    let vitals: HealthVitals

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if let summary = vitals.summaryText {
                Text(verbatim: summary)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if vitals.items.isEmpty {
                SectionEmptyCard("No Garmin data yet", systemImage: "heart.text.square")
            } else {
                TileGrid(vitals.items) { vital in TodayVitalTile(vital: vital) }
            }
        }
    }
}

/// One vital as a compact tile.
private struct TodayVitalTile: View {
    @Environment(\.koboTheme) private var theme
    let vital: HealthVital

    var body: some View {
        StatTile(
            verbatim: vital.label,
            value: vital.valueText ?? "–",
            unit: vital.unit.flatMap { $0.isEmpty ? nil : $0 },
            delta: delta
        ) {
            VStack(alignment: .leading, spacing: Space.xs) {
                if let range = vital.range {
                    TodayRangeBar(range: range, isOff: vital.isOff).padding(.top, Space.xxs)
                }
                foot
            }
        }
    }

    /// "Low" or "High" in red, only when the value is off in the bad direction.
    private var delta: StatDelta? {
        guard vital.isOff else { return nil }
        let text = vital.status == "above" ? String(localized: "High") : String(localized: "Low")
        return StatDelta(verbatim: text, tone: .danger, symbol: vital.status == "above" ? "arrow.up" : "arrow.down")
    }

    /// The foot, then the stale day in amber.
    @ViewBuilder private var foot: some View {
        if vital.footText != nil || vital.staleText != nil {
            HStack(spacing: Space.xs) {
                if let footText = vital.footText {
                    Text(verbatim: footText).foregroundStyle(theme.palette.textSecondary)
                }
                if let stale = vital.staleText {
                    Text(verbatim: stale).foregroundStyle(theme.palette.warning.ink)
                }
            }
            .font(theme.font(.caption))
            .lineLimit(2)
        }
    }
}
