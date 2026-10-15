import Foundation

/// How the hero digits of a `NumberEntry` fit their column. A text field does not shrink its text by itself, so the
/// line lays out at full size and scales down by the ratio of the column to the digits' natural width; the scale
/// springs, so a long number shrinks smoothly instead of jumping between font sizes.
nonisolated enum NumberEntrySizing {
    /// The smallest scale a long number gets before it would truncate.
    static let minimumScale: CGFloat = 0.4

    /// The scale that fits content of `contentWidth` into `availableWidth`, never above 1 or below `minimumScale`.
    /// An unmeasured width (zero) keeps the full size.
    static func fittedScale(contentWidth: CGFloat, availableWidth: CGFloat) -> CGFloat {
        guard contentWidth > 0, availableWidth > 0 else { return 1 }
        return max(minimumScale, min(1, availableWidth / contentWidth))
    }
}
