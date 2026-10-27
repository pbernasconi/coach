import Foundation

/// When a chat transcript follows new content to the bottom. The transcript is pinned while the reader is within
/// `threshold` of the bottom; it then follows every new message and every line a streamed reply adds. A reader who
/// scrolls up to read is never pulled down, and gets the jump-to-latest button instead.
nonisolated struct ChatScrollFollow: Equatable, Sendable {
    /// How close to the bottom still counts as "at the bottom", in points.
    static let threshold: Double = 48

    private(set) var isPinned = true
    /// The reader is more than half a screen up: only then does the jump-to-latest button show.
    private(set) var isFar = false

    /// The reader's distance from the bottom changed (a scroll, or the content grew under a reader who scrolled up).
    /// `visibleHeight` is the scroll view's height; without it, any distance past the threshold counts as far.
    mutating func scrolled(distanceFromBottom: Double, visibleHeight: Double = 0) {
        isPinned = distanceFromBottom <= Self.threshold
        isFar = distanceFromBottom > max(Self.threshold, visibleHeight / 2)
    }

    /// Whether new or longer content should scroll the transcript to the bottom.
    func followsNewContent() -> Bool { isPinned }

    /// Whether the jump-to-latest button shows.
    var showsJumpButton: Bool { !isPinned && isFar }

    /// The reader tapped jump-to-latest, or sent a message: pin again.
    mutating func jumped() {
        isPinned = true
        isFar = false
    }

    /// The distance from the visible bottom edge to the end of the content: zero when the content fits between the
    /// insets (a short conversation is always "at the bottom"). `offsetY` is the scroll view's content offset, which
    /// is minus the top inset at the top.
    static func distanceFromBottom(
        contentHeight: Double,
        offsetY: Double,
        visibleHeight: Double,
        insetTop: Double = 0,
        insetBottom: Double = 0
    ) -> Double {
        if contentHeight <= visibleHeight - insetTop - insetBottom { return 0 }
        return max(0, contentHeight + insetBottom - (offsetY + visibleHeight))
    }
}
