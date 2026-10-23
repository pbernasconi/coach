import KoboComponents
import KoboTokens
import SwiftUI

/// The coach's side of Settings, from the server: the next event and the weekly targets, then every service Coach
/// reads from, one row each with its state as a coloured dot and one short line. Nothing while it loads or when Lift
/// is not connected (the This iPhone section says how to connect); a short line when it could not be read.
struct SettingsCoachSections: View {
    let remote: AppResourceState<AppSettings>
    let send: (SettingsAction) -> Void

    var body: some View {
        switch remote.content {
        case .loaded(let settings):
            if let coach = settings.coach.value, coach.nextEvent != nil || coach.targetsText != nil {
                SettingsCoachSection(coach: coach)
            }
            if let connections = settings.connections.value {
                SettingsConnectionList(connections: connections)
            }
        case .failed:
            ListSection("Connections") {
                ListRow("Could not load", value: nil, action: { send(.retryTapped) }) {
                    EmptyView()
                } trailing: {
                    Text("Try again")
                }
            }
        case .loading, .empty:
            EmptyView()
        }
    }
}

/// The next event and the weekly targets, as plain rows.
private struct SettingsCoachSection: View {
    let coach: AppSettings.Coach

    var body: some View {
        ListSection("Coach") {
            if let event = coach.nextEvent {
                ListRow(
                    verbatim: event.name,
                    subtitle: [event.dateText, "\(event.priority) race"].compactMap(\.self).joined(separator: " · "),
                    value: event.countdownText
                ) {
                    SettingsIcon(symbol: "flag.checkered", tone: .accent)
                }
            }
            if let targets = coach.targetsText {
                ListRow(verbatim: String(localized: "Weekly targets"), subtitle: targets) {
                    SettingsIcon(symbol: "target", tone: .info)
                }
            }
        }
    }
}

/// One row per service; the summary under them.
private struct SettingsConnectionList: View {
    let connections: AppSettings.Connections

    var body: some View {
        ListSection(verbatim: String(localized: "Connections"), footer: connections.summary.text) {
            ForEach(connections.items) { item in
                ListRow(verbatim: item.name, subtitle: item.note ?? item.detailText, value: item.statusText) {
                    SettingsIcon(symbol: Self.symbol(item.id), tone: .neutral)
                } trailing: {
                    SettingsStatusDot(level: item.level, state: item.state)
                }
            }
        }
    }

    private static func symbol(_ id: String) -> String {
        switch id {
        case "strava": "figure.run"
        case "garmin": "applewatch"
        case "calendar": "calendar"
        case "lift": "dumbbell.fill"
        case "bodyspec": "figure.stand"
        case "function": "cross.vial"
        case "scale": "scalemass"
        default: "link"
        }
    }
}

/// A connection's state as a small dot: green connected, amber attention, red error, grey off. The row's text says
/// the same in words, so colour is never the only cue.
private struct SettingsStatusDot: View {
    @Environment(\.koboTheme) private var theme
    let level: String
    let state: String

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: Space.sm, height: Space.sm)
            .accessibilityLabel(Text(label))
    }

    private var color: Color {
        if state == "off" { return level == "error" ? theme.palette.danger.ink : theme.palette.textTertiary }
        switch level {
        case "error": return theme.palette.danger.ink
        case "warn": return theme.palette.warning.ink
        default: return theme.palette.success.ink
        }
    }

    private var label: LocalizedStringKey {
        switch state {
        case "connected": "Connected"
        case "attention": "Needs attention"
        case "error": "Error"
        default: "Not connected"
        }
    }
}

/// A row's icon in a small rounded square, as the system Settings shows them.
struct SettingsIcon: View {
    @Environment(\.koboTheme) private var theme
    let symbol: String
    let tone: Tone

    var body: some View {
        Image(systemName: symbol)
            .font(theme.font(.footnote).weight(.semibold))
            .foregroundStyle(ink)
            .frame(width: Size.iconLg + Space.xs, height: Size.iconLg + Space.xs)
            .background(fill, in: RoundedRectangle(cornerRadius: Radius.xs, style: .continuous))
            .accessibilityHidden(true)
    }

    private var ink: Color {
        switch tone {
        case .accent: theme.palette.accentText
        case .info: theme.palette.info.ink
        case .success: theme.palette.success.ink
        case .warning: theme.palette.warning.ink
        case .danger: theme.palette.danger.ink
        default: theme.palette.textSecondary
        }
    }

    private var fill: Color {
        switch tone {
        case .accent: theme.palette.accentSoft
        case .info: theme.palette.info.soft
        case .success: theme.palette.success.soft
        case .warning: theme.palette.warning.soft
        case .danger: theme.palette.danger.soft
        default: theme.palette.surfaceSunken
        }
    }
}
