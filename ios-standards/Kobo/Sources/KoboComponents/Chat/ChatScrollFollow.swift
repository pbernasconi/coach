import Foundation

/// When a chat transcript follows new content to the bottom. The transcript is pinned while the reader is within
/// `threshold` of the bottom; it then follows every new message and every line a streamed reply adds. A reader who
/// scrolls up to read is never pulled down, and gets the jump-to-latest button instead.
nonisolated struct ChatScrollFollow: Equatable, Sendable {
    /// How close to the bottom still counts as "at the bottom", in points.
    static let threshold: Double = 48

    private(set) var isPinned = true

    /// The reader's distance from the bottom changed (a scroll, or the content grew under a reader who scrolled up).
    mutating func scrolled(distanceFromBottom: Double) {
        isPinned = distanceFromBottom <= Self.threshold
    }

    /// Whether new or longer content should scroll the transcript to the bottom.
    func followsNewContent() -> Bool { isPinned }

    /// Whether the jump-to-latest button shows.
    var showsJumpButton: Bool { !isPinned }

    /// The reader tapped jump-to-latest, or sent a message: pin again.
    mutating func jumped() { isPinned = true }

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
