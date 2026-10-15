import Foundation
import KoboTokens

/// The pure maths of `.shake(trigger:)`, tested without rendering. One shake is a row of legs: a short settle out to
/// `-distance`, `Motion.Shake.swings` swings from side to side, and a short settle back to rest. Each leg eases in and
/// out, so the view never jerks at a turn.
nonisolated enum ShakeMath {
    /// One leg of a shake: where it ends and how long it takes.
    struct Leg: Equatable {
        let target: CGFloat
        let duration: TimeInterval
    }

    /// The legs of one shake, in order: settle out, the swings, settle back to rest.
    static var legs: [Leg] {
        let distance = Motion.Shake.distance
        let swings = (0..<Motion.Shake.swings).map { index in
            Leg(target: index.isMultiple(of: 2) ? distance : -distance, duration: Motion.Shake.swing)
        }
        return [Leg(target: -distance, duration: Motion.Shake.settle)] + swings
            + [Leg(target: 0, duration: Motion.Shake.settle)]
    }

    /// One shake lasts its swings plus a settle at each end.
    static var duration: TimeInterval {
        Motion.Shake.settle * 2 + Motion.Shake.swing * Double(Motion.Shake.swings)
    }

    /// The sideways offset at `progress` shakes in: zero at every whole number, so the view always ends at rest.
    static func offset(progress: CGFloat) -> CGFloat {
        let fraction = progress - progress.rounded(.down)
        let time = Double(fraction) * duration
        var start: CGFloat = 0
        var elapsed: TimeInterval = 0
        for leg in legs {
            if time < elapsed + leg.duration {
                let local = (time - elapsed) / leg.duration
                let eased = (1 - cos(local * .pi)) / 2
                return start + (leg.target - start) * CGFloat(eased)
            }
            elapsed += leg.duration
            start = leg.target
        }
        return 0
    }
}
