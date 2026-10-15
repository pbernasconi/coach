import Foundation

/// The layout rules of a pinned flow footer. The footer does not scroll, so a long failure reason at a large text size
/// or in landscape could push the primary action off the screen: the banner takes the full height of its text up to
/// `maxBannerShare` of the step height, and past that cap its text scrolls inside the banner.
nonisolated enum FlowFooterLayout {
    /// The largest share of the step height a footer banner takes before its text scrolls.
    static let maxBannerShare: Double = 0.4

    /// The banner cap for a step of `stepHeight` points, or `nil` before the step is measured.
    static func bannerCap(stepHeight: Double) -> Double? {
        stepHeight > 0 ? (stepHeight * maxBannerShare).rounded(.down) : nil
    }

    /// The banner height: all of its content, up to the cap.
    static func bannerHeight(contentHeight: Double, cap: Double) -> Double {
        min(max(contentHeight, 0), cap)
    }

    /// The "why is this disabled" caption shows only while the action is disabled and not running, so the button is
    /// never a dead end and a spinner never sits under a stale hint.
    static func showsHint(hasHint: Bool, isEnabled: Bool, isLoading: Bool) -> Bool {
        hasHint && !isEnabled && !isLoading
    }
}
