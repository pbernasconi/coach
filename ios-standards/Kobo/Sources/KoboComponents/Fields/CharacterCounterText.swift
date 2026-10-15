import KoboTokens
import SwiftUI

/// The counter under a limited `KoboTextArea`: "12/40", or "20 characters left" near a long limit. Near the limit it
/// takes the warning ink and a glyph, so the warning never reads by colour alone.
struct CharacterCounterText: View {
    @Environment(\.koboTheme) private var theme
    let count: Int
    let limit: Int

    var body: some View {
        if let caption = CharacterCounter.caption(count: count, limit: limit) {
            HStack(spacing: Space.xxs) {
                if isNear {
                    Image(systemName: "exclamationmark.triangle.fill").accessibilityHidden(true)
                }
                text(caption)
                    .monospacedDigit()
            }
            .font(theme.font(.footnote))
            .foregroundStyle(isNear ? theme.palette.warning.ink : theme.palette.textSecondary)
            .padding(.top, Space.xs)
            .accessibilityElement(children: .combine)
        }
    }

    private var isNear: Bool { CharacterCounter.isNearLimit(count: count, limit: limit) }

    private func text(_ caption: CharacterCounter.Caption) -> Text {
        switch caption {
        case .fraction(let count, let limit): Text(verbatim: "\(count)/\(limit)")
        case .remaining(let left): Text("\(left) characters left", bundle: .module)
        }
    }
}
