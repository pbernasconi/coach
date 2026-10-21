import KoboComponents
import KoboTokens
import SwiftUI

/// One activity in the list: the sport's icon in its colour, the name, when, the server's summary line and the plan
/// workout it completed.
struct ActivityRow: View {
    let activity: ActivitySummary
    let action: () -> Void
    @ScaledMetric(relativeTo: .body) private var badge = Size.iconLg + Space.md
    @Environment(\.koboTheme) private var theme

    var body: some View {
        ListRow(verbatim: activity.name, subtitle: subtitle, action: action) {
            activity.sportStyle.icon
                .font(theme.font(.body))
                .frame(width: badge, height: badge)
                .background(activity.sportStyle.color.opacity(0.14), in: Circle())
        }
        // The icon is hidden, so the sport leads the label, as on the Week plan rows: "Run: Harbour loop".
        .accessibilityLabel(Text(verbatim: "\(activity.typeText): \(activity.name)"))
        .accessibilityValue(Text(verbatim: subtitle))
    }

    /// "Sat, Oct 17 · 7:15 AM · Run", the summary line, then "Plan: Easy run".
    private var subtitle: String {
        var lines = ["\(activity.startText) · \(activity.typeText)"]
        if !activity.subtitle.isEmpty { lines.append(activity.subtitle) }
        if let planned = activity.plannedTitle {
            lines.append(String(localized: "Plan: \(planned)"))
        }
        return lines.joined(separator: "\n")
    }
}
