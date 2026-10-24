import KoboTokens
import SwiftUI

/// How a pinned footer separates itself from the content scrolling under it.
public enum PinnedFooterStyle: Sendable, Equatable {
    /// Follows the theme: `.glass` for `Theme.SurfaceStyle.glass`, otherwise `.material`.
    case automatic
    /// Floating Liquid Glass controls with no panel behind them, grouped in one `GlassEffectContainer` so
    /// neighbouring buttons blend and morph. Pass glass buttons; the footer adds no glass of its own, so
    /// glass never stacks on glass (UI-10).
    case glass
    /// An edge-to-edge bar material with a top hairline that shows while content scrolls under the footer.
    case material
}

extension View {
    /// Pins primary actions to the bottom of the screen. The footer is a bottom safe area bar, so scrolling content
    /// stops above it, fades and blurs as it passes under (the system's soft scroll edge, as under the tab bar), and
    /// the home indicator area stays clear. Apply it to the scroll view: the
    /// `.material` footer then draws its top hairline only while content runs under it.
    ///
    ///     ScrollView { … }
    ///         .pinnedFooter { Button("Save", action: save).buttonStyle(.glassProminent) }
    public func pinnedFooter<Footer: View>(
        style: PinnedFooterStyle = .automatic,
        isPresented: Bool = true,
        @ViewBuilder footer: () -> Footer
    ) -> some View {
        modifier(PinnedFooterHost(style: style, isPresented: isPresented, footer: footer()))
    }
}

/// Watches the scroll view it is applied to, so the footer knows when content runs under it.
private struct PinnedFooterHost<Footer: View>: ViewModifier {
    let style: PinnedFooterStyle
    let isPresented: Bool
    let footer: Footer
    @State private var contentIsUnder = false

    func body(content: Content) -> some View {
        content
            .onScrollGeometryChange(for: Bool.self) { geometry in
                FooterEdge.showsHairline(
                    contentHeight: geometry.contentSize.height,
                    visibleMaxY: geometry.visibleRect.maxY,
                    bottomInset: geometry.contentInsets.bottom
                )
            } action: { _, isUnder in
                contentIsUnder = isUnder
            }
            // A bar, not a plain inset: content scrolling under it softens and blurs away, like it does under the
            // tab bar, so floating glass buttons never sit on hard-edged rows.
            .safeAreaBar(edge: .bottom, spacing: 0) {
                if isPresented {
                    PinnedFooter(style: style, showsEdge: contentIsUnder) { footer }
                }
            }
            .scrollEdgeEffectStyle(.soft, for: .bottom)
    }
}

/// The bottom action bar used by `.pinnedFooter`. Use it directly in custom layouts.
public struct PinnedFooter<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    private let style: PinnedFooterStyle
    private let showsEdge: Bool
    private let content: Content

    /// A footer for a custom layout; its `.material` hairline always shows.
    public init(style: PinnedFooterStyle = .automatic, @ViewBuilder content: () -> Content) {
        self.init(style: style, showsEdge: true, content: content)
    }

    init(style: PinnedFooterStyle, showsEdge: Bool, @ViewBuilder content: () -> Content) {
        self.style = style
        self.showsEdge = showsEdge
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
                .overlay(alignment: .top) {
                    Separator().opacity(showsEdge ? 1 : 0).koboAnimation(.state, value: showsEdge)
                }
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
                Button("Save trip") {}
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
