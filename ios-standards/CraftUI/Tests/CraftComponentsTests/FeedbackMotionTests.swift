import CraftTokens
import Foundation
import Testing

@testable import CraftComponents

@Suite struct FeedbackMotionTests {
    // MARK: Toast swipe

    @Test(arguments: [
        (-40.0, 0.0, true),  // far enough up
        (40.0, 0.0, true),  // far enough down
        (-10.0, 0.0, false),  // a nudge springs back
        (-10.0, -400.0, true),  // a flick up
        (10.0, 400.0, true),  // a flick down
        (-10.0, 400.0, false),  // a flick against the drag
        (0.0, -400.0, false),  // no movement at all
    ])
    func toastSwipeDismisses(translation: Double, velocity: Double, expected: Bool) {
        #expect(ToastSwipe.dismisses(translation: CGFloat(translation), velocity: CGFloat(velocity)) == expected)
    }

    @Test func toastSwipeExitKeepsGoingTheSameWay() {
        #expect(ToastSwipe.exitOffset(translation: -40) < -40)
        #expect(ToastSwipe.exitOffset(translation: 40) > 40)
    }

    // MARK: Skeleton breath

    @Test func breathStartsFullAndDipsOnePulseLater() {
        #expect(SkeletonBreathMotion.opacity(at: 0) == 1)
        #expect(
            abs(SkeletonBreathMotion.opacity(at: Motion.Duration.pulse) - SkeletonBreathMotion.minimumOpacity) < 1e-9
        )
        #expect(abs(SkeletonBreathMotion.opacity(at: Motion.Duration.pulse * 2) - 1) < 1e-9)
    }

    @Test(arguments: Array(stride(from: 0.0, through: 4.0, by: 0.25)))
    func breathStaysInRange(seconds: Double) {
        let opacity = SkeletonBreathMotion.opacity(at: seconds)
        #expect(opacity >= SkeletonBreathMotion.minimumOpacity - 1e-9 && opacity <= 1 + 1e-9)
    }

    // MARK: Shimmer

    @Test func shimmerSweepsFromOffOneEdgeToOffTheOther() {
        #expect(abs(ShimmerMotion.phase(at: 0) + ShimmerMotion.bandHalfWidth) < 1e-9)
        #expect(abs(ShimmerMotion.phase(at: ShimmerMotion.period / 2) - 0.5) < 1e-9)
    }

    @Test(arguments: [-1.0, 0.3, 1.1, 2.5, 100.0])
    func shimmerPhaseStaysInBand(seconds: Double) {
        let phase = ShimmerMotion.phase(at: seconds)
        #expect(phase >= -ShimmerMotion.bandHalfWidth - 1e-9)
        #expect(phase <= 1 + ShimmerMotion.bandHalfWidth + 1e-9)
    }

    // MARK: Pulse

    @Test func pulseLeavesTheEdgeVisibleAndFadesAsItGrows() {
        let start = PulseMotion.frame(at: 0)
        #expect(start.spread == 0)
        #expect(start.opacity == PulseMotion.peakOpacity)

        let late = PulseMotion.frame(at: PulseMotion.period * 0.99)
        #expect(late.spread > start.spread)
        #expect(late.spread <= PulseMotion.spread)
        #expect(late.opacity < 0.01)
    }

    // MARK: Tone glyphs

    @Test(arguments: Tone.allCases)
    func everyToneHasAGlyph(_ tone: Tone) {
        #expect(!tone.feedbackSymbol.isEmpty)
    }
}
