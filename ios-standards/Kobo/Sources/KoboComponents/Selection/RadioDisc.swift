import KoboTokens
import SwiftUI

/// The drawn disc of a radio choice: an empty ring when off, the accent disc with a check when on, so the choice never
/// rests on colour alone. Same size, motion and glyph as `CheckboxBox`. Decorative: the row or button that holds it
/// carries the label and the selected trait.
struct RadioDisc: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .body) private var side = Size.iconLg
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle().fill(fill)
            Circle().strokeBorder(rim, lineWidth: isSelected ? 0 : Space.xxs)
            Image(systemName: "checkmark")
                .font(theme.font(.caption).weight(.bold))
                .foregroundStyle(isEnabled ? theme.palette.onAccent : theme.palette.textTertiary)
                .scaleEffect(isSelected ? 1 : CheckboxBox.hiddenGlyphScale)
                .opacity(isSelected ? 1 : 0)
                .koboAnimation(.snappy, value: isSelected)
        }
        .frame(width: side, height: side)
        .koboAnimation(.state, value: isSelected)
        .accessibilityHidden(true)
    }

    private var fill: Color {
        switch (isSelected, isEnabled) {
        case (true, true): theme.palette.accent
        case (true, false): theme.palette.accentSoft
        case (false, true): theme.palette.surface
        case (false, false): theme.palette.surfaceRaised
        }
    }

    private var rim: Color {
        isEnabled ? theme.palette.textSecondary : theme.palette.separator
    }
}
