import Foundation
import KoboTokens

/// The maths of an `InlineProgress` bar. Pure, so tests check it without rendering.
nonisolated enum InlineProgressMath {
    /// One full sweep of the indeterminate band.
    static let period: TimeInterval = Motion.Duration.pulse * 2
    /// The width of the indeterminate band, as a share of the track.
    static let bandWidth: Double = 0.35

    /// `value / total`, clamped to 0...1. A missing, negative or non-finite input reads as 0.
    static func fraction(_ value: Double, total: Double) -> Double {
        guard total > 0, value.isFinite, total.isFinite else { return 0 }
        return min(max(value / total, 0), 1)
    }

    /// The whole percentage VoiceOver reads for `fraction` ("40%").
    static func percent(_ fraction: Double) -> Int {
        Int((min(max(fraction, 0), 1) * 100).rounded())
    }

    /// The leading edge of the indeterminate band at `seconds`, in unit space: it starts fully off the leading edge
    /// and ends fully off the trailing edge, so the loop has no visible jump.
    static func bandOffset(at seconds: TimeInterval) -> Double {
        let raw = seconds.truncatingRemainder(dividingBy: period) / period
        let progress = raw < 0 ? raw + 1 : raw
        return -bandWidth + (1 + bandWidth) * progress
    }
}
