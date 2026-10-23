import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The newest lab draw: its date, how many results are in range, and each out-of-range biomarker with its value,
/// reference range and status (a red pill with its words).
struct TodayLabsView: View {
    @Environment(\.koboTheme) private var theme
    let labs: HealthLabs

    var body: some View {
        if let drawn = labs.drawDateText {
            VStack(alignment: .leading, spacing: Space.sm) {
                VStack(alignment: .leading, spacing: Space.xs) {
                    Text(verbatim: String(localized: "\(labs.counts.inRange) of \(labs.counts.total) in range"))
                        .font(theme.font(.headline).monospacedDigit())
                        .foregroundStyle(theme.palette.textPrimary)
                    Text(verbatim: String(localized: "Drawn \(drawn)"))
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                }
                if !labs.items.isEmpty {
                    ListSection {
                        ForEach(labs.items) { item in TodayLabRow(item: item) }
                    }
                }
                if labs.moreCount > 0 {
                    Text(verbatim: String(localized: "\(labs.moreCount) more out of range on the web"))
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textTertiary)
                }
            }
        } else {
            SectionEmptyCard("No lab results yet", systemImage: "cross.vial")
        }
    }
}

/// "Apolipoprotein B", "Range ≤ 90", "98 mg/dL" and its status.
private struct TodayLabRow: View {
    let item: HealthLabItem

    var body: some View {
        ListRow(
            verbatim: item.name,
            subtitle: subtitle,
            leading: { EmptyView() },
            trailing: {
                StatusPill(verbatim: item.statusText, tone: item.status == "out_of_range" ? .danger : .neutral)
                    .fixedSize()
            }
        )
    }

    /// "98 mg/dL · range ≤ 90".
    private var subtitle: String {
        let value = [item.valueText, item.unit].compactMap(\.self).joined(separator: " ")
        guard let range = item.rangeText else { return value }
        return String(localized: "\(value) · range \(range)")
    }
}
