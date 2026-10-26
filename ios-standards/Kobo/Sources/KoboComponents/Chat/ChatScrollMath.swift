import Foundation
import KoboTokens

/// When the transcript counts as "at the latest message". Pure, so tests check it without scrolling.
nonisolated enum ChatScrollMath {
    /// How far above the end the reader may be and still follow new text as it arrives.
    static let followThreshold: CGFloat = Space.xxxl * 2

    /// Whether the visible area ends within `followThreshold` of the content's end. Content shorter than the
    /// container is always at the end.
    static func isAtEnd(contentHeight: CGFloat, visibleMaxY: CGFloat) -> Bool {
        contentHeight - visibleMaxY <= followThreshold
    }
}
