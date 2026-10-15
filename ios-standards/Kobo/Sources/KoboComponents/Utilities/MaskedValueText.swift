import Foundation

/// The text a `MaskedValue` draws. Pure, so tests check it without rendering. The mask never holds the real value.
nonisolated enum MaskedValueText {
    /// The default mask: two bullets, as in a card or account tail ("••1234").
    static let defaultMask = "••"

    /// `prefix`, the mask, then `tail` after `tailSeparator` (only when there is a tail).
    static func text(prefix: String?, tail: String?, mask: String, tailSeparator: String) -> String {
        let revealed = tail.map { $0.isEmpty ? "" : tailSeparator + $0 } ?? ""
        return (prefix ?? "") + mask + revealed
    }

    /// The last `count` characters of `value`, for a tail ("4242" from a full card number). Never more than the value.
    static func tail(of value: String, count: Int) -> String {
        String(value.suffix(max(count, 0)))
    }
}
