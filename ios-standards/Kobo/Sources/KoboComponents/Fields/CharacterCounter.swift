import Foundation

/// The counter rule under a text field with a length limit. Length counts what people see as characters
/// (grapheme clusters), so "é", "👍🏽" and a flag each count once. A short limit always shows "12/40"; a long limit
/// shows "20 characters left" only near the limit, so the counter is signal, not noise. The field stops at the limit,
/// so reaching it is a warning, never an error.
nonisolated enum CharacterCounter {
    /// What the counter shows.
    enum Caption: Equatable, Sendable {
        /// "12/40".
        case fraction(count: Int, limit: Int)
        /// "20 characters left".
        case remaining(Int)
    }

    /// The largest limit that always shows the count.
    static let alwaysShownLimit = 140
    /// A long limit shows the counter from this share of the limit.
    static let nearLimitShare = 0.8
    /// The counter takes the warning ink from this share of any limit.
    static let warningShare = 0.9

    /// The number of characters in `text`, as people count them.
    static func count(_ text: String) -> Int { text.count }

    /// `text` cut to `limit` characters, never splitting a character. A non-positive limit means no limit.
    static func clamped(_ text: String, to limit: Int) -> String {
        guard limit > 0, text.count > limit else { return text }
        return String(text.prefix(limit))
    }

    /// The caption under the field, or `nil` when no counter shows.
    static func caption(count: Int, limit: Int) -> Caption? {
        guard limit > 0 else { return nil }
        if limit <= alwaysShownLimit { return .fraction(count: count, limit: limit) }
        guard Double(count) >= Double(limit) * nearLimitShare else { return nil }
        return .remaining(max(limit - count, 0))
    }

    /// True near the limit: the counter takes the warning ink and glyph.
    static func isNearLimit(count: Int, limit: Int) -> Bool {
        limit > 0 && Double(count) >= Double(limit) * warningShare
    }

    /// True once the text fills the limit: announce once, never on each keystroke.
    static func isAtLimit(count: Int, limit: Int) -> Bool {
        limit > 0 && count >= limit
    }
}
