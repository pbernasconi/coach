import CraftTokens
import Foundation
import SwiftUI

public extension View {
    /// Breathes this view's opacity between full and a dimmer low point, the calm alternative to a shimmer.
    /// Every breathing view reads the same frame clock, so a whole screen of placeholders dims together.
    /// Static at full opacity with Reduce Motion on.
    func skeletonBreath() -> some View {
        modifier(SkeletonBreathModifier())
    }
}

/// The breath curve. Pure, so tests check it without rendering.
enum SkeletonBreath {
    /// The opacity at the dimmest point of a breath.
    static let minimumOpacity = 0.6

    /// Full at the start of each cycle, `minimumOpacity` one pulse later, on a sine ease in and out.
    static func opacity(at seconds: TimeInterval) -> Double {
        let cycle = Motion.Duration.pulse * 2
        let phase = seconds.truncatingRemainder(dividingBy: cycle) / cycle
        let depth = (1 - cos(2 * Double.pi * phase)) / 2
        return 1 - (1 - minimumOpacity) * depth
    }
}

private struct SkeletonBreathModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        TimelineView(.animation(minimumInterval: nil, paused: reduceMotion)) { context in
            content.opacity(
                reduceMotion ? 1 : SkeletonBreath.opacity(at: context.date.timeIntervalSinceReferenceDate)
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
