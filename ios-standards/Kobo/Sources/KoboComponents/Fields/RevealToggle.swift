import KoboTokens
import SwiftUI

/// The eye button that shows or hides a secret: a password, a masked number. The glyph swaps with a cross-fade
/// (none with Reduce Motion) and VoiceOver reads what the next tap does.
struct RevealToggle: View {
    @Environment(\.koboTheme) private var theme
    let isRevealed: Bool
    let showLabel: Text
    let hideLabel: Text
    let action: () -> Void

    var body: some View {
        FieldIconButton(
            systemImage: isRevealed ? "eye.slash" : "eye",
            label: isRevealed ? hideLabel : showLabel,
            tint: theme.palette.accentText,
            action: action
        )
        .contentTransition(.symbolEffect(.replace))
        .koboAnimation(.state, value: isRevealed)
    }
}
