import Foundation

/// Turns an exercise name into comparable tokens: case- and diacritic-insensitive, punctuation and emoji
/// stripped, parentheses dropped, simple plurals singular, and shorthand expanded (db → dumbbell,
/// oh → overhead, kb → kettlebell, bb → barbell, "kettle bell" → kettlebell).
enum NameNormalizer {
    private static let synonyms: [String: String] = [
        "db": "dumbbell", "dbs": "dumbbell", "dumbell": "dumbbell", "oh": "overhead", "kb": "kettlebell",
        "bb": "barbell",
    ]
    private static let compounds: [(String, String, String)] = [
        ("kettle", "bell", "kettlebell"), ("dumb", "bell", "dumbbell"), ("bar", "bell", "barbell"),
    ]

    static func tokens(_ name: String) -> [String] {
        let folded = name.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: posix).lowercased()
        let withoutNotes = folded.replacing(/\([^)]*\)/, with: " ").replacingOccurrences(of: "'", with: "")
        let spaced = String(withoutNotes.map { $0.isASCII && ($0.isLetter || $0.isNumber) ? $0 : " " })
        let words = joinCompounds(spaced.split(separator: " ").map(String.init))
        return words.map { singular(synonyms[$0] ?? $0) }
    }

    /// The tokens joined by single spaces: the key used for exact comparisons.
    static func key(_ name: String) -> String {
        tokens(name).joined(separator: " ")
    }

    private static let posix = Locale(identifier: "en_US_POSIX")

    private static func joinCompounds(_ words: [String]) -> [String] {
        var result: [String] = []
        for word in words {
            if let previous = result.last,
                let compound = compounds.first(where: { $0.0 == previous && $0.1 == word })
            {
                result[result.count - 1] = compound.2
            } else {
                result.append(word)
            }
        }
        return result
    }

    private static func singular(_ word: String) -> String {
        guard word.count >= 3, word.hasSuffix("s"), !word.hasSuffix("ss") else { return word }
        return String(word.dropLast())
    }
}
