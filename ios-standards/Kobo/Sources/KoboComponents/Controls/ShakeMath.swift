import Foundation
import KoboTokens

/// The pure maths of `.shake(trigger:)`, tested without rendering.
nonisolated enum ShakeMath {
    /// The sideways offset at `progress` shakes in: zero at every whole number, so the view always ends at rest.
    static func offset(progress: CGFloat) -> CGFloat {
        let swings = CGFloat(Motion.Shake.swings)
        return Motion.Shake.distance * sin(progress * swings * 2 * .pi)
    }

    /// One shake lasts its swings plus a settle at each end.
    static var duration: TimeInterval {
        Motion.Shake.settle * 2 + Motion.Shake.swing * Double(Motion.Shake.swings)
    }
}
