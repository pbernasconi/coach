import Foundation
import KoboTokens

/// The swipe-to-dismiss rule of a toast: pure maths, so it is tested without rendering.
/// The card follows the finger both ways; a release far enough, or a flick fast enough, in either direction dismisses.
nonisolated enum ToastSwipe {
    /// A release this far from the resting place dismisses.
    static let dismissDistance: CGFloat = Space.xxxl
    /// A flick at this speed (points per second) dismisses before it reaches `dismissDistance`.
    static let dismissVelocity: CGFloat = 300

    /// Whether a release at `translation` moving at `velocity` (both vertical, negative is up) dismisses the toast.
    static func dismisses(translation: CGFloat, velocity: CGFloat) -> Bool {
        if abs(translation) >= dismissDistance { return true }
        guard translation != 0, abs(velocity) >= dismissVelocity else { return false }
        // A flick only counts when it moves the way the card already went.
        return (translation < 0) == (velocity < 0)
    }

    /// Where a dismissed card heads: on in the direction of the swipe, off its resting place.
    static func exitOffset(translation: CGFloat) -> CGFloat {
        translation < 0 ? translation - dismissDistance : translation + dismissDistance
    }
}
