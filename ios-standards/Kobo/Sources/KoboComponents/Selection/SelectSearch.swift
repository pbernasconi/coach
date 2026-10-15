import Foundation

/// The search of a `SelectSheet`, apart from SwiftUI. Ported from an earlier app's `SelectSearch` ranking, with Kobo's
/// `SearchMatch` for the title so matching ignores case and diacritics and works word by word. An exact keyword beats
/// a title prefix, which beats a keyword prefix, which beats any other title or subtitle match, so "CH" finds
/// Switzerland (keyword "CH") before Chad. Equal ranks keep the option order. A blank query keeps every option.
nonisolated enum SelectSearch {
    /// The searchable text of one option.
    struct Candidate: Sendable, Equatable {
        let title: String
        let subtitle: String?
        let keywords: [String]

        init(title: String, subtitle: String? = nil, keywords: [String] = []) {
            self.title = title
            self.subtitle = subtitle
            self.keywords = keywords
        }
    }

    /// One option that matched: its index in the list and the ranges of its title to highlight.
    struct Result: Equatable {
        let index: Int
        let titleRanges: [Range<String.Index>]
    }

    /// Search turns on by itself at this many options, unless the caller decides.
    static let autoThreshold = 8

    /// Whether the sheet shows its search field: the caller's choice, else from `autoThreshold` options up.
    static func isEnabled(_ searchable: Bool?, optionCount: Int) -> Bool {
        searchable ?? (optionCount >= autoThreshold)
    }

    /// The options that match `query`, best rank first.
    static func filter(_ candidates: [Candidate], query: String) -> [Result] {
        let needle = SearchMatch.tokens(query).joined(separator: " ")
        guard !needle.isEmpty else { return candidates.indices.map { Result(index: $0, titleRanges: []) } }
        let ranked = candidates.enumerated().compactMap { index, candidate -> Ranked? in
            rank(candidate, needle: needle, query: query).map { Ranked(index: index, rank: $0.rank, match: $0.match) }
        }
        let sorted = ranked.sorted { lhs, rhs in
            if lhs.rank != rhs.rank { return lhs.rank > rhs.rank }
            if lhs.score != rhs.score { return lhs.score > rhs.score }
            return lhs.index < rhs.index
        }
        return sorted.map { Result(index: $0.index, titleRanges: $0.match?.ranges ?? []) }
    }

    /// The rank tiers, best first.
    enum Rank: Int, Comparable {
        case otherMatch = 1
        case keywordPrefix = 2
        case titlePrefix = 3
        case exactKeyword = 4

        static func < (lhs: Rank, rhs: Rank) -> Bool { lhs.rawValue < rhs.rawValue }
    }

    private struct Ranked {
        let index: Int
        let rank: Rank
        let match: SearchMatch?
        var score: Int { match?.score ?? 0 }
    }

    /// The rank of one option and its title match, or `nil` when nothing matches.
    private static func rank(_ candidate: Candidate, needle: String, query: String) -> (rank: Rank, match: SearchMatch?)? {
        let title = SearchMatch(candidate.title, query: query)
        let options = SearchMatch.options
        if candidate.keywords.contains(where: { $0.compare(needle, options: options) == .orderedSame }) {
            return (.exactKeyword, title)
        }
        let trimmed = candidate.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if title != nil, trimmed.range(of: needle, options: options.union(.anchored)) != nil {
            return (.titlePrefix, title)
        }
        if candidate.keywords.contains(where: { $0.range(of: needle, options: options.union(.anchored)) != nil }) {
            return (.keywordPrefix, title)
        }
        let subtitle = candidate.subtitle.flatMap { SearchMatch($0, query: query) }
        if title != nil || subtitle != nil { return (.otherMatch, title) }
        return nil
    }
}
