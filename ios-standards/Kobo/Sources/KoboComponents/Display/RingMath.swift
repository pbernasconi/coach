import Foundation

/// Pure ring maths, tested without rendering.
nonisolated enum RingMath {
    /// `progress` clamped to 0...1; `NaN` reads as empty.
    static func clamp(_ progress: Double) -> Double {
        guard !progress.isNaN else { return 0 }
        return min(max(progress, 0), 1)
    }
}
