import KoboComponents
import KoboTokens
import SwiftUI

/// Step 5: the week day by day, against last week, the sessions to keep if the week goes sideways, and where it
/// syncs. The bar's Accept and sync takes it (SCR-2).
struct PlannerReviewStep: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            SectionHeader(verbatim: String(localized: "Your week, ready to go"), subtitle: week.totalsText)
            KeyValueList(
                items: week.days.map { day in
                    KeyValueItem(verbatim: day.labelText, value: summary(day), id: day.date)
                }
            )
            if !week.versus.isEmpty {
                KeyValueList(
                    verbatim: week.versusTitle,
                    items: week.versus.map { row in
                        KeyValueItem(
                            verbatim: row.label,
                            value: "\(row.beforeText)  →  \(row.afterText)",
                            id: row.label
                        )
                    }
                )
            }
            if !week.keepers.isEmpty { keep(week.keepers) }
            if let headline = week.review?.headline { coach(headline) }
            Label {
                Text("Goes to \(week.syncsTo.formatted(.list(type: .and))). Moves on your calendar win.")
            } icon: {
                Image(systemName: "arrow.triangle.2.circlepath")
            }
            .font(theme.font(.footnote))
            .foregroundStyle(theme.palette.textSecondary)
        }
    }

    private func coach(_ headline: String) -> some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text("Coach")
                .font(theme.font(.caption).weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(theme.palette.accentText)
            Text(verbatim: headline)
                .font(theme.font(.callout))
                .foregroundStyle(theme.palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg)
        .background(theme.palette.accentWash, in: .rect(cornerRadius: Radius.lg, style: .continuous))
    }

    private func keep(_ keepers: [PlannerWeek.Keeper]) -> some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader("If the week goes sideways", subtitle: "Keep these and the week still moves you forward.")
            FlowLayout {
                ForEach(keepers) { keeper in
                    Label {
                        Text(verbatim: "\(keeper.title) · \(keeper.dayText)")
                    } icon: {
                        keeper.sportKind.icon
                    }
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .padding(.horizontal, Space.md)
                    .padding(.vertical, Space.xs)
                    .background(keeper.sportKind.color.opacity(0.16), in: .capsule)
                }
            }
        }
    }

    /// "Lower 40 min, Easy run 45 min", or "Rest".
    private func summary(_ day: PlannerWeek.Day) -> String {
        guard !day.sessions.isEmpty else { return String(localized: "Rest") }
        return day.sessions.map { [$0.title, $0.lengthText].compactMap(\.self).joined(separator: " ") }
            .joined(separator: ", ")
    }
}
