import Foundation

/// Digit helpers for `NumberEntry`: grouping, leading zeros and the canonical text filter. The canonical text of a
/// number has ASCII digits and at most one `.`, never a grouping mark: `""`, `"0"`, `"1234"`, `"12.5"`, `"1234."`.
nonisolated enum NumberGrouping {
    /// `"1234567"` grouped with `","` → `"1,234,567"`. Empty stays empty; a `nil` separator leaves the digits as is.
    static func grouped(_ integer: Substring, separator: Character?) -> String {
        guard let separator else { return String(integer) }
        var result = ""
        for (index, character) in integer.enumerated() {
            if index > 0, (integer.count - index) % 3 == 0 { result.append(separator) }
            result.append(character)
        }
        return result
    }

    /// Keeps the ASCII digits and dots, and drops everything else (signs, spaces, letters).
    static func digitsAndDots(_ text: String) -> String {
        String(text.filter { isDigit($0) || $0 == "." })
    }

    /// `"007"` → `"7"`, but `"0"` stays, so `"0.05"` can be typed.
    static func withoutLeadingZeros(_ integer: Substring) -> Substring {
        let trimmed = integer.drop { $0 == "0" }
        return trimmed.isEmpty && !integer.isEmpty ? "0" : trimmed
    }

    /// An ASCII digit. Other scripts' digits ("٤", "４") are not typed by a decimal pad and are dropped.
    static func isDigit(_ character: Character) -> Bool {
        character.isASCII && character.isNumber
    }
}
