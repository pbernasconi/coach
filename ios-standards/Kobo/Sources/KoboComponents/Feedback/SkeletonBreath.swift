import Foundation
import KoboTokens
import SwiftUI

extension View {
    /// Breathes this view's opacity between full and a dimmer low point, the calm alternative to a shimmer.
    /// Every breathing view reads the same frame clock, so a whole screen of placeholders dims together.
    /// Static at full opacity with Reduce Motion on, or under `koboFreezesMotion` (snapshots).
    public func skeletonBreath() -> some View {
        modifier(SkeletonBreathModifier())
    }
}

private struct SkeletonBreathModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.koboFreezesMotion) private var freezesMotion

    func body(content: Content) -> some View {
        let still = reduceMotion || freezesMotion
        TimelineView(.animation(minimumInterval: nil, paused: still)) { context in
            content.opacity(still ? 1 : SkeletonBreathMotion.opacity(at: context.date.timeIntervalSinceReferenceDate))
        }
    }
}

#if DEBUG
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
#endif
