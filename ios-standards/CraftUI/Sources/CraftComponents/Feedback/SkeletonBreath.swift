import CraftTokens
import Foundation
import SwiftUI

extension View {
    /// Breathes this view's opacity between full and a dimmer low point, the calm alternative to a shimmer.
    /// Every breathing view reads the same frame clock, so a whole screen of placeholders dims together.
    /// Static at full opacity with Reduce Motion on.
    public func skeletonBreath() -> some View {
        modifier(SkeletonBreathModifier())
    }
}

private struct SkeletonBreathModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        TimelineView(.animation(minimumInterval: nil, paused: reduceMotion)) { context in
            content.opacity(
                reduceMotion ? 1 : SkeletonBreathMotion.opacity(at: context.date.timeIntervalSinceReferenceDate)
            )
        }
    }
}

#Preview("Breath") {
    VStack(alignment: .leading, spacing: Space.sm) {
        Skeleton(.line).frame(width: Size.thumbnail * 3)
        Skeleton(.block).frame(height: Size.thumbnail)
    }
    .skeletonBreath()
    .padding()
}

#Preview("Breath, dark") {
    Skeleton(.block).frame(height: Size.thumbnail).skeletonBreath().padding().preferredColorScheme(.dark)
}

#Preview("Breath, AX3") {
    Skeleton(.line).skeletonBreath().padding().dynamicTypeSize(.accessibility3)
}
