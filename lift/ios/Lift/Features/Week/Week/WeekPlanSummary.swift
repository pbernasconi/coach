import KoboComponents
import KoboTokens
import SwiftUI

/// The visible week's coach plan line above the days: its title, the server's totals and when the plan was fetched
/// (or that the phone is offline and shows the kept plan).
struct WeekPlanSummary: View {
    @Environment(\.koboTheme) private var theme
    let plan: WeekPlanHeader

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            if let title = plan.title {
                Text(verbatim: title)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
            }
            Text(verbatim: plan.totals)
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
            if let freshness = plan.freshness {
                Label {
                    Text(verbatim: freshness)
                } icon: {
                    Image(systemName: plan.isOffline ? "wifi.slash" : "checkmark.icloud")
                        .accessibilityHidden(true)
                }
                .font(theme.font(.caption))
                .foregroundStyle(plan.isOffline ? theme.palette.textSecondary : theme.palette.textTertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .koboCard()
        .accessibilityElement(children: .combine)
    }
}
