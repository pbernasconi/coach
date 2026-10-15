import Foundation
import KoboTokens

/// The ring's curve. Pure, so tests check it without rendering.
nonisolated enum PulseMotion {
    /// One full pulse: the ring grows from the edge and fades out.
    static let period: TimeInterval = Motion.Duration.pulse * 2
    /// How far past the view's edge the ring travels.
    static let spread: CGFloat = Space.sm
    /// The ring's opacity as it leaves the edge.
    static let peakOpacity = 0.55
    /// The still halo shown with Reduce Motion on.
    static let reducedSpread: CGFloat = Space.xs
    static let reducedOpacity = 0.35

    /// The ring at `seconds`: how far out it is and how visible.
    static func frame(at seconds: TimeInterval) -> (spread: CGFloat, opacity: Double) {
        var progress = seconds.truncatingRemainder(dividingBy: period) / period
        if progress < 0 { progress += 1 }
        let eased = 1 - (1 - progress) * (1 - progress)  // ease out: fast from the edge, settling as it fades
        return (spread * CGFloat(eased), peakOpacity * (1 - progress))
    }
}
