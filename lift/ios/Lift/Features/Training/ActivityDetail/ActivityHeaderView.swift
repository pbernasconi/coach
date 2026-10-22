import KoboComponents
import KoboTokens
import SwiftUI

/// The page's title block, the shared workout header without a status pill: the sport and when, the name, then the
/// place, the plan workout it completed (a check in the compliance colour), Strava's description and the "still
/// loading" note. A done activity needs no "Done" pill; the older and newer arrows are in the bar.
struct ActivityHeaderView: View {
    let header: ActivityHeader
    let planned: ActivityCoach.Planned?
    @Environment(\.koboTheme) private var theme

    var body: some View {
        WorkoutHeader(
            sport: header.sportStyle,
            kicker: kicker,
            title: header.name,
            status: nil,
            statusLabel: ""
        ) {
            VStack(alignment: .leading, spacing: Space.xs) {
                if let place = header.place {
                    line(place, symbol: "mappin.and.ellipse", color: theme.palette.textSecondary)
                }
                if let planned {
                    line(
                        [planned.title, planned.compliance.label].joined(separator: " · "),
                        symbol: "checkmark.circle.fill",
                        color: ActivityCompliance.color(planned.compliance.level, theme: theme)
                    )
                    .accessibilityLabel(Text("Planned: \(planned.title), \(planned.compliance.label)"))
                }
            }
            if let description = header.description, !description.isEmpty {
                Text(verbatim: description)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
                    .padding(.top, Space.xs)
            }
            if let note = header.fetch.note {
                InlineNotice(verbatim: note, tone: header.fetch.pending ? .info : .warning)
            }
        }
    }

    /// "Run · Saturday, October 17, 2026 at 7:15 AM", with "Indoor" or "Commute" when Strava says so.
    private var kicker: String {
        [
            header.typeText, header.whenText, header.indoor ? String(localized: "Indoor") : nil,
            header.commute ? String(localized: "Commute") : nil,
        ]
        .compactMap(\.self)
        .joined(separator: " · ")
    }

    /// A small line under the title: an icon and text.
    private func line(_ text: String, symbol: String, color: Color) -> some View {
        Label {
            Text(verbatim: text).foregroundStyle(theme.palette.textSecondary)
        } icon: {
            Image(systemName: symbol).foregroundStyle(color).accessibilityHidden(true)
        }
        .font(theme.font(.subheadline))
    }
}

/// The web's compliance colours (`ComplianceMark`): good and done green, partial amber, off red, the rest grey.
nonisolated enum ActivityCompliance {
    static func tone(_ level: String) -> Tone {
        switch level {
        case "good", "done": .success
        case "partial": .warning
        case "off", "missed": .danger
        default: .neutral
        }
    }

    static func color(_ level: String, theme: Theme) -> Color {
        switch tone(level) {
        case .success: theme.palette.success.ink
        case .warning: theme.palette.warning.ink
        case .danger: theme.palette.danger.ink
        default: theme.palette.textTertiary
        }
    }
}
