import Foundation
import KoboTokens

/// The initials and tint rules behind `Avatar`. Pure, so every client gives a name the same monogram and colour.
public enum Monogram {
    /// The tones an avatar may take. Danger is left out on purpose: a red person reads as an error.
    public static let tones: [Tone] = [.accent, .info, .success, .warning, .neutral]

    /// "Ada Lovelace" → "AL", "ada" → "A", "Jean-Luc Picard" → "JP", "  " → "".
    /// Takes the first letter or digit of the first and last words; words with none ("&") do not count.
    public static func initials(from name: String) -> String {
        let letters =
            name
            .split(whereSeparator: \.isWhitespace)
            .compactMap { word in word.first { $0.isLetter || $0.isNumber } }
        guard let first = letters.first else { return "" }
        guard letters.count > 1, let last = letters.last else { return String(first).uppercased() }
        return (String(first) + String(last)).uppercased()
    }

    /// A stable tone for `name`: djb2 over the trimmed, lowercased UTF-16 units, so it never changes between launches.
    public static func tone(for name: String) -> Tone {
        let key = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let hash = key.utf16.reduce(UInt32(5381)) { hash, unit in hash &* 33 &+ UInt32(unit) }
        return tones[Int(hash % UInt32(tones.count))]
    }
}
