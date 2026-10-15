import Foundation

/// When a pinned footer draws its top hairline: only while content runs under it. At rest above the footer, and at
/// the end of the scroll, the edge draws nothing, so the hairline never cuts through the last row for no reason.
/// Ported from an earlier app's `FooterEdge`; pure, so it is tested without rendering.
nonisolated enum FooterEdge {
    /// Half a point of slack absorbs layout rounding at the end of the scroll.
    static let slack: CGFloat = 0.5

    /// True while the bottom of the content is below the top of the footer. Every value is in the scroll view's
    /// content coordinates: `visibleMaxY` is the bottom of the scroll view's bounds and `bottomInset` the part the
    /// footer (and the home indicator) covers. Unmeasured content (height 0) draws nothing.
    static func showsHairline(contentHeight: CGFloat, visibleMaxY: CGFloat, bottomInset: CGFloat) -> Bool {
        guard contentHeight > 0 else { return false }
        return contentHeight > visibleMaxY - bottomInset + slack
    }
}
