import Foundation
import Testing

@testable import KoboComponents

@Suite struct ControlsIconButtonMetricsTests {
    @Test(arguments: [(36.0, 36.0, 36.0), (36.0, 48.0, 48.0), (36.0, 90.0, 54.0), (44.0, 30.0, 30.0)])
    func capsTheScaledSizeAtOneAndAHalfTimesTheBase(base: Double, scaled: Double, expected: Double) {
        #expect(IconButtonMetrics.capped(CGFloat(scaled), base: CGFloat(base)) == CGFloat(expected))
    }
}
