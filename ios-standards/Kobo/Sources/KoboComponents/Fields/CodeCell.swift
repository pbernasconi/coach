import KoboTokens
import SwiftUI

/// One decorative `CodeInput` cell, on the field tokens: the resting hairline, the thicker accent ring on the active
/// cell and the danger ring on an error. A PIN cell draws a dot, never the character. The active empty cell shows a
/// caret bar.
struct CodeCell: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .title2) private var height = Size.thumbnail
    let character: Character?
    let isActive: Bool
    let showsCaret: Bool
    let isError: Bool
    let masked: Bool

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
        ZStack {
            if let character {
                Text(verbatim: masked ? "\u{2022}" : String(character))
                    .font(theme.font(.title2).weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(isEnabled ? theme.palette.textPrimary : theme.palette.textTertiary)
                    .dynamicTypeSize(...DynamicTypeSize.accessibility1)
            } else if showsCaret {
                Capsule()
                    .fill(theme.palette.accent)
                    .frame(width: Space.xxs, height: height / 2)
            }
        }
        .frame(maxWidth: .infinity, minHeight: height)
        .background(isEnabled ? theme.palette.surface : theme.palette.surfaceRaised, in: shape)
        .overlay { shape.strokeBorder(border, lineWidth: isError || isActive ? Space.xxs : Size.hairline) }
        .koboAnimation(.state, value: isActive)
    }

    private var border: Color {
        if isError { return theme.palette.danger.ink }
        if isActive { return theme.palette.accent }
        return isEnabled ? theme.palette.separator : .clear
    }
}
