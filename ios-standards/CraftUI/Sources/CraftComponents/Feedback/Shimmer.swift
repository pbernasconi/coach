import CraftTokens
import Foundation
import SwiftUI

public extension View {
    /// Sweeps a soft highlight across this view's drawn pixels while `active`: skeletons, or text under
    /// `.redacted(reason: .placeholder)`. Frozen (no sweep) with Reduce Motion on.
    func shimmering(active: Bool = true) -> some View {
        modifier(ShimmerModifier(active: active))
    }
}

/// The timing of the highlight sweep. Pure, so tests check it without rendering.
enum ShimmerMotion {
    /// One full sweep, left edge to right edge.
    static let period: TimeInterval = Motion.Duration.pulse * 2
    /// Half the width of the highlight band, as a share of the view's width.
    static let bandHalfWidth: Double = 0.3

    /// The band's centre at `seconds`, in unit space: it starts fully off the leading edge and ends fully off the
    /// trailing edge, so the loop has no visible jump.
    static func phase(at seconds: TimeInterval) -> Double {
        let progress = seconds.truncatingRemainder(dividingBy: period) / period
        let start = -bandHalfWidth
        let end = 1 + bandHalfWidth
        return start + (end - start) * (progress < 0 ? progress + 1 : progress)
    }
}

private struct ShimmerModifier: ViewModifier {
    let active: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.craftTheme) private var theme

    func body(content: Content) -> some View {
        content.overlay {
            if active && !reduceMotion {
                TimelineView(.animation(minimumInterval: nil, paused: false)) { context in
                    band(phase: ShimmerMotion.phase(at: context.date.timeIntervalSinceReferenceDate))
                }
                // Only where the content drew something, so it follows skeleton shapes and redacted text.
                .mask { content }
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
        }
    }

    private func band(phase: Double) -> some View {
        LinearGradient(
            colors: [.clear, highlight, .clear],
            startPoint: UnitPoint(x: phase - ShimmerMotion.bandHalfWidth, y: 0.5),
            endPoint: UnitPoint(x: phase + ShimmerMotion.bandHalfWidth, y: 0.5)
        )
    }

    /// Lighter than the placeholder fill in both appearances.
    private var highlight: Color {
        colorScheme == .dark ? theme.palette.textTertiary : theme.palette.surface.opacity(0.7)
    }
}

#Preview("Shimmer") {
    VStack(alignment: .leading, spacing: Space.sm) {
        Skeleton(.line).frame(width: Size.thumbnail * 3)
        Skeleton(.block).frame(height: Size.thumbnail)
        Text("Placeholder headline").font(.headline).redacted(reason: .placeholder)
    }
    .shimmering()
    .padding()
}

#Preview("Shimmer, dark") {
    Skeleton(.block).frame(height: Size.thumbnail).shimmering().padding().preferredColorScheme(.dark)
}

#Preview("Shimmer, AX3") {
    Text("Placeholder body copy").redacted(reason: .placeholder).shimmering().padding()
        .dynamicTypeSize(.accessibility3)
}
