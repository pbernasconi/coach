import KoboTokens
import SwiftUI

/// One icon button of a `ToolbarPill`: its glyph, its spoken label and its action.
public struct ToolbarPillItem: Identifiable {
    public let id: String
    public let systemImage: String
    public let label: Text
    public let action: () -> Void

    /// An item; `label` is what VoiceOver reads (the glyph has no text).
    public init(_ systemImage: String, label: LocalizedStringKey, action: @escaping () -> Void) {
        self.id = systemImage
        self.systemImage = systemImage
        self.label = Text(label)
        self.action = action
    }

    /// An item whose label is runtime text.
    public init(_ systemImage: String, verbatimLabel: String, action: @escaping () -> Void) {
        self.id = systemImage
        self.systemImage = systemImage
        self.label = Text(verbatim: verbatimLabel)
        self.action = action
    }
}

/// A floating group of icon buttons in one capsule of Liquid Glass (the raised fill under a solid theme), for a screen
/// that hides its navigation bar and floats its controls over the content (a chat's settings, history and new). The
/// glyphs are plain inside the one glass shape, never glass on glass. With one item it is a round button of the same
/// glass, for a close button that sits beside a pill.
///
///     ToolbarPill([ToolbarPillItem("gearshape", label: "Settings", action: openSettings),
///                  ToolbarPillItem("plus", label: "New chat", action: newChat)])
public struct ToolbarPill: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var side = Size.minTouch - Space.xs
    private let items: [ToolbarPillItem]

    public init(_ items: [ToolbarPillItem]) {
        self.items = items
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(items) { item in
                Button(action: item.action) {
                    Image(systemName: item.systemImage)
                        .font(theme.font(.callout).weight(.regular))
                        .foregroundStyle(theme.palette.textPrimary)
                        .frame(width: side, height: side)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.label)
            }
        }
        // One item is a circle (a close button beside a pill); more spread out in a capsule.
        .padding(.horizontal, items.count > 1 ? Space.xs : Space.xxs)
        .padding(.vertical, Space.xxs)
        .headerGlass(in: Capsule())
        .overlay {
            Capsule().strokeBorder(
                LinearGradient(
                    colors: [theme.palette.surface, theme.palette.separator],
                    startPoint: .top,
                    endPoint: .bottom
                ),
                lineWidth: Size.hairline
            )
        }
    }
}

#if DEBUG
    private struct ToolbarPillPreview: View {
        var body: some View {
            VStack {
                HStack {
                    Spacer()
                    ToolbarPill([
                        ToolbarPillItem("gearshape", verbatimLabel: "Settings") {},
                        ToolbarPillItem("clock.arrow.circlepath", verbatimLabel: "History") {},
                        ToolbarPillItem("plus", verbatimLabel: "New") {},
                    ])
                }
                Spacer()
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Toolbar pill") { ToolbarPillPreview() }
    #Preview("Toolbar pill · dark") { ToolbarPillPreview().preferredColorScheme(.dark) }
    #Preview("Toolbar pill · AX3") { ToolbarPillPreview().dynamicTypeSize(.accessibility3) }
#endif
