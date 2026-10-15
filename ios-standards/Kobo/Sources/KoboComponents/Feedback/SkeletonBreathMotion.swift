import Foundation
import KoboTokens

/// The breath curve. Pure, so tests check it without rendering.
nonisolated enum SkeletonBreathMotion {
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
