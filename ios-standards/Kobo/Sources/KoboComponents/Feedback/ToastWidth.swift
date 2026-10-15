import Foundation
import KoboTokens

/// The width rule of a toast: pure maths, tested without rendering. Ported from an earlier app's `ToastMetrics`.
///
/// The toast hugs its one-line message up to a cap that leaves a navigation bar's circular buttons uncovered on both
/// sides, so only a message wider than the cap wraps (between words, to at most two lines at default text sizes).
nonisolated enum ToastWidth {
    /// The room kept free on each side of the window: the gutter, a 44pt bar button and a gap.
    static let edgeReserve: CGFloat = Space.gutter + Size.minTouch + Space.md
    /// The narrowest cap, for a small window or a split view.
    static let minimumLimit: CGFloat = Size.minTouch * 4
    /// The most lines a message takes at a default text size.
    static let defaultLineLimit = 2

    /// The widest a toast grows in a window `containerWidth` wide.
    static func maxWidth(containerWidth: CGFloat) -> CGFloat {
        max(containerWidth - 2 * edgeReserve, minimumLimit)
    }

    /// The toast width: its one-line ideal width, never wider than the proposal or the cap. The host pads the toast
    /// with the gutter, so the cap measures the proposal plus that gutter. With no finite proposal the ideal wins.
    static func width(idealWidth: CGFloat, proposedWidth: CGFloat?) -> CGFloat {
        guard let proposedWidth, proposedWidth.isFinite else { return idealWidth }
        return min(idealWidth, proposedWidth, maxWidth(containerWidth: proposedWidth + 2 * Space.gutter))
    }

    /// Two lines at a default text size; no limit at an accessibility size, so large copy never truncates.
    static func lineLimit(isAccessibilitySize: Bool) -> Int? {
        isAccessibilitySize ? nil : defaultLineLimit
    }
}
