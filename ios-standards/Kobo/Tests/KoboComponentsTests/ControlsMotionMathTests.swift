import Foundation
import KoboTokens
import Testing

@testable import KoboComponents

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

    @Test func shakeSettlesOutToTheFirstSwingAndBackToRest() {
        let distance = Motion.Shake.distance
        let settleEnd = CGFloat(Motion.Shake.settle / ShakeMath.duration)
        // Out to the far side at the end of the first settle, and on the near side after the first swing.
        #expect(abs(ShakeMath.offset(progress: settleEnd) + distance) < 1e-9)
        let firstSwingEnd = CGFloat((Motion.Shake.settle + Motion.Shake.swing) / ShakeMath.duration)
        #expect(abs(ShakeMath.offset(progress: firstSwingEnd) - distance) < 1e-9)
        // The legs: one settle out, the swings, one settle home.
        #expect(ShakeMath.legs.count == Motion.Shake.swings + 2)
        #expect(ShakeMath.legs.last?.target == 0)
        #expect(ShakeMath.legs.map(\.duration).reduce(0, +) == ShakeMath.duration)
    }

    @Test func shakeEasesIntoRestInsteadOfStopping() {
        // Just before the end the view is already close to rest: the last leg eases in.
        let nearEnd = ShakeMath.offset(progress: 0.99)
        #expect(abs(nearEnd) < Motion.Shake.distance * 0.1)
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
