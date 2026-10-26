import Foundation
import KoboTokens

/// The chat components' fixed measures. Pure, so the logic tests can read them.
nonisolated enum ChatMetrics {
    /// The space a bubble leaves on the leading side, so the reader's messages read as theirs.
    static let bubbleLeadingInset: CGFloat = Space.xxxl * 2
    /// A bubble on its way is a little faint until it lands.
    static let sendingOpacity = 0.7
    /// The dots' look when motion is off: between rest and full.
    static let stillDotOpacity = 0.65
    /// The tallest the composer grows before its text scrolls.
    static let composerMaxLines = 6
    /// The dashed rim of a change set that waits for a decision.
    static let proposalRimWidth: CGFloat = Space.xxs * 0.75
    static let proposalDash: [CGFloat] = [Space.sm, Space.xs]
}
