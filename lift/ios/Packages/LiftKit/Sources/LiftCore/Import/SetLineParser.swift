import Foundation

/// Reads set lines: `8 x 255`, `10 @ 45`, `8 @ 25lb`, `10x 25lb both arms`, `8 x 2x 65lb`,
/// `10x 1x 40 each hand`, `8`, `15 x 75lb DEEP SQUAT`.
enum SetLineParser {
    private static let perHandPhrases = [
        "each hand", "per hand", "both arms", "both hands", "each arm", "per arm", "each side", "per dumbbell",
    ]
    private static let perSidePhrases = ["per side", "a side"]

    /// Nil when the text does not start with a rep count.
    static func parse(_ text: String) -> ParsedSet? {
        let pattern =
            /(?<reps>\d{1,3})(?:\s*(?:x|×|@)\s*(?:(?<count>[12])\s*[x×]\s*)?(?<value>\d+(?:\.\d+)?)\s*(?<times>\*\s*2)?\s*(?<unit>kgs?|lbs?|#)?)?(?<rest>.*)/
        guard let match = text.wholeMatch(of: pattern.ignoresCase()), let reps = Int(match.output.reps) else {
            return nil
        }
        let rest = String(match.output.rest)
        if let first = rest.first, first.isNumber || first == "." { return nil }
        var parsed = ParsedSet(reps: reps)
        parsed.weightValue = match.output.value.flatMap { Double($0) }
        parsed.unit = match.output.unit.flatMap { NoteHintParser.unit(String($0)) }
        let (note, perHand, perSide) = readNote(rest)
        parsed.perHand = perHand || match.output.count == "2" || match.output.times != nil
        parsed.perSide = perSide
        parsed.note = note
        return parsed
    }

    /// Strips a leading "reps", load phrases and punctuation; reports whether a load phrase was present.
    private static func readNote(_ rest: String) -> (note: String?, perHand: Bool, perSide: Bool) {
        var note = rest.replacing(/^\s*reps?\b/.ignoresCase(), with: "")
        let lowered = note.lowercased()
        let perHand = perHandPhrases.contains(where: lowered.contains)
        let perSide = perSidePhrases.contains(where: lowered.contains)
        for phrase in perHandPhrases + perSidePhrases {
            note = note.replacingOccurrences(of: phrase, with: "", options: .caseInsensitive)
        }
        return (tidy(note), perHand, perSide)
    }

    /// Trims spaces and leading/trailing dashes, commas and colons; nil when nothing is left.
    static func tidy(_ text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: CharacterSet(charactersIn: " -–—,:;"))
        return trimmed.isEmpty ? nil : trimmed
    }
}
