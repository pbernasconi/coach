import Foundation

/// When a chat transcript follows new content to the bottom. The transcript is pinned while the reader is within
/// `threshold` of the bottom; it then follows every new message and every line a streamed reply adds. Only the reader
/// unpins it, by scrolling up: content that grows under a pinned reader (a reply streaming, a card arriving) never
/// does. A reader who scrolls up to read is never pulled down, and gets the jump-to-latest button once far enough up.
nonisolated struct ChatScrollFollow: Equatable, Sendable {
    /// How close to the bottom still counts as "at the bottom", in points.
    static let threshold: Double = 48
    /// The jump-to-latest button needs the latest content at least this far below, in points.
    static let farDistance: Double = 600
    /// ... and at least this many screens below.
    static let farScreens: Double = 1.5

    private(set) var isPinned = true
    /// The latest content is more than one and a half screens (and at least `farDistance`) below what shows. Worked
    /// out afresh on every change, so it never outlives a scroll back down (2026-11-22: a stale value showed the
    /// button just above the composer while a reply streamed).
    private(set) var isFar = false

    /// The reader's distance from the bottom changed. `byReader` is true only when the reader moved the transcript up
    /// themselves; growth under the reader, or a programmatic scroll, leaves a pinned transcript pinned. `visibleHeight`
    /// is the scroll view's height; without it, `farDistance` alone decides what is far.
    mutating func scrolled(distanceFromBottom: Double, visibleHeight: Double = 0, byReader: Bool = true) {
        if distanceFromBottom <= Self.threshold {
            isPinned = true
        } else if byReader {
            isPinned = false
        }
        isFar = distanceFromBottom > max(Self.farDistance, visibleHeight * Self.farScreens)
    }

    /// The visible height changed (the keyboard came or went): the distance jumps for a moment, so the button hides
    /// until the reader scrolls again.
    mutating func resized() {
        isFar = false
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
