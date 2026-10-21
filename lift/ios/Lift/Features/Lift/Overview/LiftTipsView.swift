import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// The coach's notes, most pressing first: a toned glyph (never colour alone), the title and the body. A note with a
/// link it can open here is a button with a chevron.
struct LiftTipsView: View {
    let tips: LiftTips
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            ForEach(tips.items) { tip in
                if Self.opens(tip.link) {
                    Button {
                        send(.tipTapped(tip.id))
                    } label: {
                        LiftTipCard(tip: tip, showsChevron: true)
                    }
                    .buttonStyle(.pressFeedback)
                } else {
                    LiftTipCard(tip: tip, showsChevron: false)
                }
            }
        }
    }

    /// Session, exercise, section and Week tab links open; a tip with no link does not.
    static func opens(_ link: LiftLink?) -> Bool {
        switch link {
        case .session, .exercise, .week: true
        case .section(let name): LiftOverviewSection(rawValue: name) != nil
        case nil: false
        }
    }
}

private struct LiftTipCard: View {
    @Environment(\.koboTheme) private var theme
    let tip: LiftTip
    let showsChevron: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.md) {
            Image(systemName: Self.symbol(tip.tone))
                .foregroundStyle(theme.palette.status(tip.tone.kobo).ink)
                .accessibilityLabel(Text(Self.toneName(tip.tone)))
            VStack(alignment: .leading, spacing: Space.xs) {
                Text(verbatim: tip.title)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                Text(verbatim: tip.body)
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .multilineTextAlignment(.leading)
        .koboCard()
        .accessibilityElement(children: .combine)
    }

    static func symbol(_ tone: AppTone) -> String {
        switch tone {
        case .good, .up: "checkmark.seal.fill"
        case .warn, .bad, .down: "exclamationmark.triangle.fill"
        case .neutral: "info.circle.fill"
        }
    }

    static func toneName(_ tone: AppTone) -> LocalizedStringKey {
        switch tone {
        case .good, .up: "Good"
        case .warn, .bad, .down: "Needs attention"
        case .neutral: "Note"
        }
    }
}
