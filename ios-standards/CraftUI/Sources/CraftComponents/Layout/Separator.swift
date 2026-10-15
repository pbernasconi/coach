import CraftTokens
import SwiftUI

/// A one-pixel hairline in `palette.separator`, optionally inset from the leading and trailing edges.
/// Decorative, so VoiceOver skips it.
///
///     Separator(leadingInset: Space.lg)
public struct Separator: View {
    @Environment(\.craftTheme) private var theme
    @Environment(\.displayScale) private var displayScale
    private let leadingInset: CGFloat
    private let trailingInset: CGFloat

    public init(leadingInset: CGFloat = 0, trailingInset: CGFloat = 0) {
        self.leadingInset = leadingInset
        self.trailingInset = trailingInset
    }

    public var body: some View {
        Rectangle()
            .fill(theme.palette.separator)
            .frame(height: 1 / displayScale)
            .padding(.leading, leadingInset)
            .padding(.trailing, trailingInset)
            .accessibilityHidden(true)
    }
}

#if DEBUG
    private struct SeparatorPreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.md) {
                Text("Full width")
                Separator()
                Text("Inset by Space.lg")
                Separator(leadingInset: Space.lg)
                Text("Inset both sides")
                Separator(leadingInset: Space.xxl, trailingInset: Space.xxl)
            }
            .padding(.vertical, Space.lg)
            .background(Theme.system.palette.surface)
        }
    }

    #Preview("Light") { SeparatorPreview() }
    #Preview("Dark") { SeparatorPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { SeparatorPreview().dynamicTypeSize(.accessibility3) }
#endif
