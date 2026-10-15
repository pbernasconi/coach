import KoboTokens
import SwiftUI

/// The close control of a full-bleed banner: a small glyph lighter than the message, in the full 44 pt target.
struct BannerDismissButton: View {
    @Environment(\.koboTheme) private var theme
    let label: Text
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(theme.font(.footnote).weight(.semibold))
                .frame(width: Size.minTouch, height: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
