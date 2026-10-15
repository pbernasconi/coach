import Foundation

/// Small readers for meaning inside free text: next-time weights, rest, skips, set kinds and units.
enum NoteHintParser {
    static func mentionsNextTime(_ text: String) -> Bool {
        text.lowercased().contains("next time")
    }

    /// The number in "next time bump to 190lb" or "go 30 next time" (after the phrase first, then before it).
    static func nextTimeWeight(in text: String) -> (value: Double, unit: WeightUnit?)? {
        let lowered = text.lowercased()
        guard let phrase = lowered.range(of: "next time") else { return nil }
        let number = /(?<value>\d+(?:\.\d+)?)\s*(?<unit>kgs?|lbs?)?/
        let after = lowered[phrase.upperBound...]
        let before = lowered[..<phrase.lowerBound]
        guard let match = after.firstMatch(of: number) ?? before.matches(of: number).last,
            let value = Double(match.output.value)
        else { return nil }
        return (value, match.output.unit.flatMap { unit(String($0)) })
    }

    /// Seconds in "60s between rounds", "rest 90s" or "2 min rest"; nil without "rest" or "between".
    static func restSeconds(in text: String) -> Int? {
        let lowered = text.lowercased()
        guard lowered.contains("rest") || lowered.contains("between") else { return nil }
        let pattern = /(?<amount>\d+)\s*(?<unit>seconds|second|secs|sec|s|minutes|minute|mins|min|m)\b/
        guard let match = lowered.firstMatch(of: pattern), let amount = Int(match.output.amount) else { return nil }
        return match.output.unit.hasPrefix("m") ? amount * 60 : amount
    }

    /// True for notes such as "didn't do it" or "skipped".
    static func isSkip(_ note: String?) -> Bool {
        guard let lowered = note?.lowercased() else { return false }
        return ["didn't do", "did not do", "didnt do", "skip"].contains(where: lowered.contains)
    }

    /// The set kind a note implies; working unless it says warm-up, drop or failure.
    static func setKind(for note: String?) -> SetKind {
        guard let lowered = note?.lowercased() else { return .working }
        if lowered.contains("warm") { return .warmUp }
        if lowered.contains("drop") { return .drop }
        if lowered.contains("failure") { return .failure }
        return .working
    }

    static func unit(_ text: String) -> WeightUnit? {
        let lowered = text.lowercased()
        if lowered.hasPrefix("kg") { return .kg }
        if lowered.hasPrefix("lb") || lowered == "#" { return .lb }
        return nil
    }
}
