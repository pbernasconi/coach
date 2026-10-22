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

/// The surface of one Week workout, styled as the web plan's chips: a done, partly done or not done card is filled with
/// a light tint of its status colour; a planned one is a dashed outline on the canvas. The left edge is the sport's
/// colour (faded while planned). The status is also an icon and a word inside the card, never colour alone.
struct WeekCard<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    let status: WeekCardStatus
    let sport: Color
    let action: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: Space.sm) { content() }
                .padding(Space.md)
                .padding(.leading, Space.xxs)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background { background }
                .overlay(alignment: .leading) {
                    UnevenRoundedRectangle(topLeadingRadius: Radius.md, bottomLeadingRadius: Radius.md, style: .continuous)
                        .fill(status == .planned ? sport.opacity(0.45) : sport)
                        .frame(width: Space.xs)
                }
                .contentShape(shape)
        }
        .buttonStyle(.pressFeedback(.scale, in: shape))
    }

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: Radius.md, style: .continuous) }

    @ViewBuilder private var background: some View {
        if let tone {
            shape.fill(theme.palette.surface)
                .overlay { shape.fill(tone.soft) }
                .overlay { shape.strokeBorder(tone.ink.opacity(0.45), lineWidth: Size.hairline * 2) }
        } else {
            shape.strokeBorder(
                theme.palette.textTertiary,
                style: StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xs, Space.xs])
            )
        }
    }

    private var tone: StatusColors? {
        switch status {
        case .planned: nil
        case .done: theme.palette.success
        case .partlyDone: theme.palette.warning
        case .notDone: theme.palette.danger
        }
    }
}

/// The status as the web marks it: a check in green (done) or yellow (partly done), an X in red (not done), with its
/// word. Nothing while planned: being on the list says it is planned.
struct WeekStatusMark: View {
    @Environment(\.koboTheme) private var theme
    let status: WeekCardStatus
    let label: String

    var body: some View {
        if let style {
            Label {
                Text(verbatim: label)
            } icon: {
                Image(systemName: style.symbol).fontWeight(.bold).accessibilityHidden(true)
            }
            .labelStyle(.titleAndIcon)
            .font(theme.font(.caption).weight(.semibold))
            .foregroundStyle(style.color)
            .fixedSize()
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
                .font(theme.font(.headline).monospacedDigit())
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
