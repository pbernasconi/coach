import Foundation
import KoboTokens
import SwiftUI

extension View {
    /// Breathes this view's opacity between full and a dimmer low point, the calm alternative to a shimmer.
    /// Every breathing view reads the same frame clock, so a whole screen of placeholders dims together.
    /// Static at full opacity with Reduce Motion on, or under `koboFreezesMotion` (snapshots). Inside a view that
    /// already breathes (a `ListRowSkeleton` in a `.skeletonPage()`), it adds nothing, so the dim never doubles.
    public func skeletonBreath() -> some View {
        modifier(SkeletonBreathModifier())
    }
}

extension EnvironmentValues {
    /// An ancestor already breathes, so a nested `.skeletonBreath()` passes its content through.
    @Entry var koboSkeletonBreathes = false
}

private struct SkeletonBreathModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.koboFreezesMotion) private var freezesMotion
    @Environment(\.koboSkeletonBreathes) private var ancestorBreathes

    func body(content: Content) -> some View {
        if ancestorBreathes {
            content
        } else {
            let still = reduceMotion || freezesMotion
            TimelineView(.animation(minimumInterval: nil, paused: still)) { context in
                content
                    .environment(\.koboSkeletonBreathes, true)
                    .opacity(still ? 1 : SkeletonBreathMotion.opacity(at: context.date.timeIntervalSinceReferenceDate))
            }
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
