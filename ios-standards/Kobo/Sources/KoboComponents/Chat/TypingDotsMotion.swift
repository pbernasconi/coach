import Foundation
import KoboTokens

/// The three dots' wave. Pure, so tests check it without rendering.
nonisolated enum TypingDotsMotion {
    /// One full wave across the three dots.
    static let period: TimeInterval = 1.2
    /// How long after one dot the next one rises.
    static let stagger: TimeInterval = 0.15
    /// How high a dot rises at the top of its step.
    static let rise: CGFloat = Space.xxs
    static let restOpacity = 0.35

    /// Dot `index` at `seconds`: how far it is raised and how visible it is.
    static func frame(index: Int, at seconds: TimeInterval) -> (rise: CGFloat, opacity: Double) {
        var phase = (seconds - Double(index) * stagger).truncatingRemainder(dividingBy: period) / period
        if phase < 0 { phase += 1 }
        // A short bump in the first third of the period, rest for the remainder.
        let bump = phase < 1.0 / 3 ? sin(phase * 3 * .pi) : 0
        return (rise * CGFloat(bump), restOpacity + (1 - restOpacity) * bump)
    }
}
