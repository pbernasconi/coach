import KoboTokens
import SwiftUI

extension View {
    /// The surface of a floating header control: interactive Liquid Glass in `shape` under a glass theme, the raised
    /// fill under a solid one. Never put it inside another glass surface.
    func headerGlass<S: Shape>(in shape: S) -> some View {
        modifier(HeaderGlass(shape: shape))
    }
}

private struct HeaderGlass<S: Shape>: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let shape: S

    func body(content: Content) -> some View {
        if theme.surfaceStyle == .glass {
            content.glassEffect(.regular.interactive(), in: shape)
        } else {
            content.background(theme.palette.surfaceRaised, in: shape)
        }
    }
}
