import Foundation
import KoboTokens
import Testing

@Suite struct MotionTests {
    @Test(arguments: Motion.allCases)
    func everyPresetIsNilUnderReduceMotion(_ motion: Motion) {
        #expect(motion.animation(reduceMotion: true) == nil)
        #expect(motion.animation(reduceMotion: false) != nil)
    }

    @Test func exitsAreFasterThanEntrances() {
        #expect(Motion.Duration.exit < Motion.Duration.enter)
        #expect(Motion.Duration.exit < Motion.Duration.overlay)
    }

    @Test(arguments: [(28.0, 8.0, 20.0), (10.0, 12.0, 0.0)])
    func concentricRadius(outer: Double, inset: Double, expected: Double) {
        let radius = Radius.concentric(outer: CGFloat(outer), inset: CGFloat(inset))
        #expect(Double(radius) == expected)
    }
}
