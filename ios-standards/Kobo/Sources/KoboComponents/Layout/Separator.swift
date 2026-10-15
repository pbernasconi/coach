import KoboTokens
import SwiftUI

/// A one-pixel hairline in `palette.separator`, optionally inset from its two ends. Horizontal by default (inset from
/// the leading and trailing edges); `.vertical` divides items in a row (inset from the top and bottom). Decorative,
/// so VoiceOver skips it.
///
///     Separator(leadingInset: Space.lg)
///     HStack { StatTile(…); Separator(axis: .vertical, leadingInset: Space.sm, trailingInset: Space.sm); StatTile(…) }
public struct Separator: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.displayScale) private var displayScale
    private let axis: Axis
    private let leadingInset: CGFloat
    private let trailingInset: CGFloat

    /// - Parameter axis: `.horizontal` insets from the leading and trailing edges; `.vertical` from top and bottom.
    public init(axis: Axis = .horizontal, leadingInset: CGFloat = 0, trailingInset: CGFloat = 0) {
        self.axis = axis
        self.leadingInset = leadingInset
        self.trailingInset = trailingInset
    }

    public var body: some View {
        Rectangle()
            .fill(theme.palette.separator)
            .frame(
                width: axis == .vertical ? 1 / displayScale : nil,
                height: axis == .horizontal ? 1 / displayScale : nil
            )
            .padding(axis == .horizontal ? .leading : .top, leadingInset)
            .padding(axis == .horizontal ? .trailing : .bottom, trailingInset)
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
                HStack(spacing: Space.md) {
                    Text("Left")
                    Separator(axis: .vertical, leadingInset: Space.xs, trailingInset: Space.xs)
                    Text("Right")
                }
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, Space.lg)
            }
            .padding(.vertical, Space.lg)
            .background(Theme.system.palette.surface)
        }
    }

    #Preview("Light") { SeparatorPreview() }
    #Preview("Dark") { SeparatorPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { SeparatorPreview().dynamicTypeSize(.accessibility3) }
#endif
