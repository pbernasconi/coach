import KoboComponents
import KoboTokens
import SwiftUI

/// Where a Week workout stands, as the web plan shows it (src/components/plan/ComplianceMark.tsx): done and partly done
/// are sessions done (a check, green or yellow), not done is missed or skipped (an X, red), planned is still to come.
nonisolated enum WeekCardStatus: Equatable, Sendable {
    case planned
    case done
    case partlyDone
    case notDone
}

/// One Week workout as a row of its day's card (`WeekDayGroup`), styled as the web plan's chips but quieter: a done,
/// partly done or not done row has a faint tint of its status colour; a planned one is the plain surface. The left edge
/// is the sport's colour (faded while planned). The day's card draws the border and the lines between rows. The status
/// is also an icon inside the row, never colour alone.
struct WeekCard<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    let status: WeekCardStatus
    let sport: Color
    let action: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: Space.xs) { content() }
                .padding(.vertical, Space.sm)
                .padding(.horizontal, Space.md)
                .padding(.leading, Space.xxs)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background { background }
                .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback(.highlight))
    }

    /// The surface, the status tint on top (none while planned), and the sport edge.
    private var background: some View {
        ZStack(alignment: .leading) {
            theme.palette.surface
            if let tone = status.tone(in: theme.palette) {
                tone.soft.opacity(WeekCardStatus.tintStrength)
            }
            Rectangle()
                .fill(status == .planned ? sport.opacity(0.45) : sport)
                .frame(width: Space.xs)
                .frame(maxHeight: .infinity)
        }
    }
}

extension WeekCardStatus {
    /// How much of the status colour's soft fill a row takes. Under half, so the sport edge and the mark lead.
    static let tintStrength = 0.45

    /// The status colours: none while planned.
    func tone(in palette: Palette) -> StatusColors? {
        switch self {
        case .planned: nil
        case .done: palette.success
        case .partlyDone: palette.warning
        case .notDone: palette.danger
        }
    }
}

/// One day's workouts as one card: its rows stacked, clipped to a rounded shape, with a hairline between rows. The
/// border is a faint status colour for a day with one done or not done workout, neutral for a day with several, and
/// dashed while everything that day is still planned.
struct WeekDayGroup<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    let statuses: [WeekCardStatus]
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 0) { content() }
            .clipShape(shape)
            .overlay { border }
    }

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: Radius.sm, style: .continuous) }

    @ViewBuilder private var border: some View {
        if statuses.allSatisfy({ $0 == .planned }) {
            shape.strokeBorder(
                theme.palette.textTertiary.opacity(0.7),
                style: StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xs, Space.xs])
            )
        } else if statuses.count == 1, let tone = statuses[0].tone(in: theme.palette) {
            shape.strokeBorder(tone.ink.opacity(0.2), lineWidth: Size.hairline * 2)
        } else {
            shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline * 2)
        }
    }
}

/// The line between two rows of a day's card, starting after the sport edge.
struct WeekRowDivider: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        Rectangle()
            .fill(theme.palette.separator)
            .frame(height: Size.hairline)
            .padding(.leading, Space.xs)
            .accessibilityHidden(true)
    }
}

/// The status as the web marks it, as an icon only: a check in green (done) or yellow (partly done), an X in red (not
/// done). VoiceOver reads its word. Nothing while planned: being on the list says it is planned.
struct WeekStatusMark: View {
    @Environment(\.koboTheme) private var theme
    let status: WeekCardStatus
    let label: String

    var body: some View {
        if let style {
            Image(systemName: style.symbol)
                .font(theme.font(.subheadline).weight(.bold))
                .foregroundStyle(style.color)
                .accessibilityLabel(Text(verbatim: label))
        }
    }

    private var style: (symbol: String, color: Color)? {
        switch status {
        case .planned: nil
        case .done: ("checkmark", theme.palette.success.ink)
        case .partlyDone: ("checkmark", theme.palette.warning.ink)
        case .notDone: ("xmark", theme.palette.danger.ink)
        }
    }
}

/// One of a card's numbers: the value large, its unit small after it ("18.2" "km"); a dash when unknown.
struct WeekStat: View {
    @Environment(\.koboTheme) private var theme
    let text: String?
    let unit: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.xxs) {
            Text(verbatim: text ?? "–")
                .font(theme.font(.callout).weight(.semibold).monospacedDigit())
                .foregroundStyle(text == nil ? theme.palette.textTertiary : theme.palette.textPrimary)
            if let unit {
                Text(verbatim: unit)
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .lineLimit(1)
        .frame(maxWidth: .infinity)
    }

    /// "18.2 km" as the value "18.2" and the unit "km"; text without a space is all value.
    static func split(_ text: String?, unit fallback: String?) -> (String?, String?) {
        guard let text else { return (nil, fallback) }
        guard let space = text.lastIndex(of: " ") else { return (text, fallback) }
        return (String(text[..<space]), String(text[text.index(after: space)...]))
    }
}
