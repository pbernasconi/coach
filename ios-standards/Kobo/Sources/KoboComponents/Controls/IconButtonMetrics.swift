import Foundation  // CGFloat; no SwiftUI, so the cap is tested on Linux

/// How far an `IconButton` grows with Dynamic Type. The disc and its glyph scale with the text up to one and a half
/// times their default size, then stop: at accessibility sizes the text next to the button carries the size, and a
/// button twice as big as its row only crowds it.
nonisolated enum IconButtonMetrics {
    /// The largest scale a disc or glyph reaches, relative to its size at the default text size.
    static let maxScale: CGFloat = 1.5

    /// `scaled` (a `@ScaledMetric` of `base`), capped at `base × maxScale`. Smaller text still shrinks it.
    static func capped(_ scaled: CGFloat, base: CGFloat) -> CGFloat {
        min(scaled, base * maxScale)
    }
}
