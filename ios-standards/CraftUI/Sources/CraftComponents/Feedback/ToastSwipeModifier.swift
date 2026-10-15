import CraftTokens
import SwiftUI

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
