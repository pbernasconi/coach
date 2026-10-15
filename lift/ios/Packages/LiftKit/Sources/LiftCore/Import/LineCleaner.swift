import Foundation

/// Evens out the characters Apple Notes pastes so the parsers see plain text.
enum LineCleaner {
    static func clean(_ raw: Substring) -> String {
        var text = String(raw)
        for (from, to) in replacements {
            text = text.replacingOccurrences(of: from, with: to)
        }
        return text.trimmingCharacters(in: .whitespaces)
    }

    private static let replacements: [(String, String)] = [
        ("\u{00A0}", " "), ("\u{2007}", " "), ("\u{202F}", " "), ("\t", " "),
        ("\u{200B}", ""), ("\u{FEFF}", ""),
        ("\u{2019}", "'"), ("\u{2018}", "'"),
    ]
}
