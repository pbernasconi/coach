import KoboTokens
import SwiftUI

/// The big digits of a `NumberEntry` and its unit. The line lays out at full size and scales down to fit its column
/// (`NumberEntrySizing`), so a long number shrinks on a spring instead of truncating; digits roll as they change. The
/// `field` slot lies over the digits with no ink of its own: the keyboard input's caret, or nothing.
struct NumberEntryHero<Field: View>: View {
    @Environment(\.koboTheme) private var theme
    @State private var contentWidth: CGFloat = 0
    @State private var availableWidth: CGFloat = 0
    let text: String
    let number: Double?
    let unit: Text?
    let field: Field

    var body: some View {
        VStack(spacing: 0) {
            // A zero-height row that takes the column width: the digits never change it, so a number that overflows
            // still reads the column, and the scale settles in one pass.
            Color.clear
                .frame(maxWidth: .infinity)
                .frame(height: 0)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { availableWidth = $0 }
                .accessibilityHidden(true)
            line
                .fixedSize()
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { contentWidth = $0 }
                .scaleEffect(scale)
                .frame(width: contentWidth > 0 ? contentWidth * scale : nil)
                .koboAnimation(.present, value: scale)
        }
    }

    private var line: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
            Text(verbatim: text.isEmpty ? "0" : text)
                .font(theme.font(.display))
                .foregroundStyle(number == nil ? theme.palette.textTertiary : theme.palette.textPrimary)
                .lineLimit(1)
                .contentTransition(.numericText(value: number ?? 0))
                .accessibilityHidden(true)
                .overlay { field }
            if let unit {
                unit
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textSecondary)
                    .accessibilityHidden(true)
            }
        }
        .koboAnimation(.defaultEffects, value: text)
    }

    private var scale: CGFloat {
        NumberEntrySizing.fittedScale(contentWidth: contentWidth, availableWidth: availableWidth)
    }
}
