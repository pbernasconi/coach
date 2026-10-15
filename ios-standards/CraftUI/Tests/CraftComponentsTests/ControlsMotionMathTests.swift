import CraftTokens
import Foundation
import Testing

@testable import CraftComponents

@Suite struct ControlsMotionMathTests {
    @Test(arguments: [0.0, 1.0, 2.0])
    func shakeRestsAtEveryWholeShake(progress: Double) {
        #expect(abs(ShakeMath.offset(progress: CGFloat(progress))) < 1e-9)
    }

    @Test func shakeNeverExceedsTheDistanceToken() {
        let offsets = stride(from: 0.0, through: 1.0, by: 0.01).map { ShakeMath.offset(progress: CGFloat($0)) }
        #expect(offsets.allSatisfy { abs($0) <= Motion.Shake.distance + 1e-9 })
        #expect(offsets.contains { abs($0) > Motion.Shake.distance * 0.9 })
    }

    @Test func shakeDurationComesFromTheTokens() {
        let expected = Motion.Shake.settle * 2 + Motion.Shake.swing * Double(Motion.Shake.swings)
        #expect(ShakeMath.duration == expected)
    }

    #if canImport(SwiftUI)  // the type lives in a SwiftUI file
        @Test func toggleFeedbackFollowsTheNewValue() {
            #expect(HapticFeedback.toggle(true) == .toggleOn)
            #expect(HapticFeedback.toggle(false) == .toggleOff)
        }
    #endif
}
