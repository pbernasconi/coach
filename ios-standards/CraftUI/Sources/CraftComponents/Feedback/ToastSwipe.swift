import CraftTokens
import SwiftUI

/// The swipe-to-dismiss rule of a toast: pure maths, so it is tested without rendering.
/// The card follows the finger both ways; a release far enough, or a flick fast enough, in either direction dismisses.
enum ToastSwipe {
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

/// Lets a toast be swiped up or down to dismiss; any other release springs it back.
struct ToastSwipeModifier: ViewModifier {
    let onDismiss: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var offset: CGFloat = 0

    init(onDismiss: @escaping () -> Void) {
        self.onDismiss = onDismiss
    }

    func body(content: Content) -> some View {
        content
            .offset(y: offset)
            .gesture(
                DragGesture(coordinateSpace: .global)
                    .onChanged { drag in offset = drag.translation.height }
                    .onEnded { drag in release(translation: drag.translation.height, velocity: drag.velocity.height) }
            )
    }

    private func release(translation: CGFloat, velocity: CGFloat) {
        guard ToastSwipe.dismisses(translation: translation, velocity: velocity) else {
            withCraftAnimation(.defaultSpatial, reduceMotion: reduceMotion) { offset = 0 }
            return
        }
        withCraftAnimation(.fastSpatial, reduceMotion: reduceMotion) {
            offset = ToastSwipe.exitOffset(translation: translation)
        }
        onDismiss()
    }
}
