import CraftTokens
import SwiftUI

/// How a pinned footer separates itself from the content scrolling under it.
public enum PinnedFooterStyle: Sendable, Equatable {
    /// Follows the theme: `.glass` for `Theme.SurfaceStyle.glass`, otherwise `.material`.
    case automatic
    /// Floating Liquid Glass controls with no panel behind them, grouped in one `GlassEffectContainer` so
    /// neighbouring buttons blend and morph. Pass glass buttons; the footer adds no glass of its own, so
    /// glass never stacks on glass (UI-10).
    case glass
    /// An edge-to-edge bar material with a top hairline.
    case material
}

extension View {
    /// Pins primary actions to the bottom of the screen. The footer sits in the bottom safe area inset,
    /// so scrolling content stops above it and the home indicator area stays clear.
    ///
    ///     ScrollView { … }
    ///         .pinnedFooter { Button("Save", action: save).buttonStyle(.glassProminent) }
    public func pinnedFooter<Footer: View>(
        style: PinnedFooterStyle = .automatic,
        isPresented: Bool = true,
        @ViewBuilder footer: () -> Footer
    ) -> some View {
        let content = footer()
        return safeAreaInset(edge: .bottom, spacing: 0) {
            if isPresented {
                PinnedFooter(style: style) { content }
            }
        }
    }
}

/// The bottom action bar used by `.pinnedFooter`. Use it directly in custom layouts.
public struct PinnedFooter<Content: View>: View {
    @Environment(\.craftTheme) private var theme
    private let style: PinnedFooterStyle
    private let content: Content

    public init(style: PinnedFooterStyle = .automatic, @ViewBuilder content: () -> Content) {
        self.style = style
        self.content = content()
    }

    public var body: some View {
        switch resolvedStyle {
        case .glass:
            GlassEffectContainer(spacing: Space.sm) {
                VStack(spacing: Space.sm) { content }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Space.gutter)
            .padding(.bottom, Space.sm)
        case .automatic, .material:
            VStack(spacing: Space.sm) { content }
                .padding(.horizontal, Space.gutter)
                .padding(.top, Space.md)
                .padding(.bottom, Space.sm)
                .frame(maxWidth: .infinity)
                .background(.bar)
                .overlay(alignment: .top) { Separator() }
        }
    }

    private var resolvedStyle: PinnedFooterStyle {
        guard style == .automatic else { return style }
        return theme.surfaceStyle == .glass ? .glass : .material
    }
}

#if DEBUG
    private struct PinnedFooterPreview: View {
        let style: PinnedFooterStyle

        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.md) {
                    ForEach(1..<31) { index in
                        Text("Row \(index)")
                    }
                }
                .padding(Space.gutter)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Theme.system.palette.canvas)
            .pinnedFooter(style: style) {
                Button("Save workout") {}
                    .buttonStyle(.glassProminent)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    #Preview("Glass") { PinnedFooterPreview(style: .glass) }
    #Preview("Material, dark") { PinnedFooterPreview(style: .material).preferredColorScheme(.dark) }
    #Preview("AX3") { PinnedFooterPreview(style: .automatic).dynamicTypeSize(.accessibility3) }
#endif
