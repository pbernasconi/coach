import CraftTokens
import Foundation

/// The timing of the highlight sweep. Pure, so tests check it without rendering.
nonisolated enum ShimmerMotion {
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
