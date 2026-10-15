import KoboTokens
import SwiftUI

extension EnvironmentValues {
    /// True when the enclosing page pads its content by the page gutter (`.pageGutter()`), so a full-width row
    /// (`ActionChipRow`, a horizontal carousel) can bleed out of it with `.bleedsPageGutter()`. False by default: a view
    /// outside such a page never draws past its container.
    @Entry public var insidePageGutter: Bool = false
}

extension View {
    /// Pads the view horizontally by the page gutter and tells its rows they sit inside it (`insidePageGutter`).
    ///
    ///     ScrollView { VStack { … }.pageGutter() }
    public func pageGutter(_ inset: CGFloat = Space.gutter) -> some View {
        padding(.horizontal, inset).environment(\.insidePageGutter, true)
    }

    /// Marks the content as padded by the page gutter, for a page that pays the gutter itself.
    public func insidePageGutter(_ inside: Bool = true) -> some View {
        environment(\.insidePageGutter, inside)
    }

    /// Runs the view out to the screen edges when it sits inside a page gutter, and leaves it alone otherwise. For a
    /// horizontally scrolling row whose first item still lines up with the gutter: pad the row's content by the gutter.
    public func bleedsPageGutter(_ inset: CGFloat = Space.gutter) -> some View {
        modifier(PageGutterBleed(inset: inset))
    }
}

private struct PageGutterBleed: ViewModifier {
    @Environment(\.insidePageGutter) private var insidePageGutter
    let inset: CGFloat

    func body(content: Content) -> some View {
        content.padding(.horizontal, insidePageGutter ? -inset : 0)
    }
}
