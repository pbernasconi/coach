import Foundation

/// How a text matches a search query: case- and diacritic-insensitive, token by token. Every word of the query must
/// appear in the text ("bench inc" matches "Incline Bench Press"); the match keeps the ranges to highlight and a score
/// to rank results by.
///
///     let results = SearchMatch.ranked(exercises, query: query) { $0.name }
///     ForEach(results, id: \.element.id) { HighlightedText($0.element.name, ranges: $0.match.ranges) }
nonisolated public struct SearchMatch: Hashable, Sendable {
    /// The matched ranges in the text, sorted and never overlapping.
    public let ranges: [Range<String.Index>]
    /// Higher is better: an exact match beats a prefix, which beats every word starting a word, which beats a match
    /// inside a word. Within a tier an earlier match ranks higher.
    public let score: Int

    /// The options every comparison uses.
    static let options: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]

    /// The match of `query` in `text`, or `nil` when some word of the query is missing. A blank query matches
    /// nothing.
    public init?(_ text: String, query: String) {
        let tokens = Self.tokens(query)
        guard !tokens.isEmpty else { return nil }
        var found: [Range<String.Index>] = []
        var atWordStart = true
        for token in tokens {
            guard let range = Self.bestRange(of: token, in: text) else { return nil }
            atWordStart = atWordStart && Self.isWordStart(range.lowerBound, in: text)
            found.append(range)
        }
        ranges = Self.merged(found)
        score = Self.score(text: text, query: tokens.joined(separator: " "), ranges: ranges, atWordStart: atWordStart)
    }

    /// The query's words: split on whitespace, blanks dropped.
    public static func tokens(_ query: String) -> [String] {
        query.split(whereSeparator: \.isWhitespace).map(String.init)
    }

    /// The elements whose `text` matches `query`, best first; equal scores keep their order. A blank query returns
    /// every element with no ranges.
    public static func ranked<Element>(_ elements: [Element], query: String, text: (Element) -> String)
        -> [(element: Element, match: SearchMatch)]
    {
        guard !tokens(query).isEmpty else {
            return elements.map { ($0, SearchMatch(ranges: [], score: 0)) }
        }
        let matched = elements.enumerated().compactMap { offset, element in
            SearchMatch(text(element), query: query).map { (offset: offset, element: element, match: $0) }
        }
        let sorted = matched.sorted { lhs, rhs in
            lhs.match.score != rhs.match.score ? lhs.match.score > rhs.match.score : lhs.offset < rhs.offset
        }
        return sorted.map { ($0.element, $0.match) }
    }

    init(ranges: [Range<String.Index>], score: Int) {
        self.ranges = ranges
        self.score = score
    }

    /// The first occurrence that starts a word, else the first occurrence.
    private static func bestRange(of token: String, in text: String) -> Range<String.Index>? {
        guard let first = text.range(of: token, options: options) else { return nil }
        var search = first
        while !isWordStart(search.lowerBound, in: text) {
            guard let next = text.range(of: token, options: options, range: search.upperBound..<text.endIndex)
            else { return first }
            search = next
        }
        return search
    }

    private static func isWordStart(_ index: String.Index, in text: String) -> Bool {
        guard index > text.startIndex else { return true }
        let previous = text[text.index(before: index)]
        return !(previous.isLetter || previous.isNumber)
    }

    private static func merged(_ ranges: [Range<String.Index>]) -> [Range<String.Index>] {
        ranges.sorted { $0.lowerBound < $1.lowerBound }.reduce(into: []) { result, range in
            if let last = result.last, range.lowerBound <= last.upperBound {
                result[result.count - 1] = last.lowerBound..<max(last.upperBound, range.upperBound)
            } else {
                result.append(range)
            }
        }
    }

    /// Tier × 1000 minus the offset of the first match, so ties break towards earlier matches.
    private static func score(text: String, query: String, ranges: [Range<String.Index>], atWordStart: Bool) -> Int {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let tier: Int
        if trimmed.compare(query, options: options) == .orderedSame {
            tier = 4
        } else if trimmed.range(of: query, options: options.union(.anchored)) != nil {
            tier = 3
        } else if atWordStart {
            tier = 2
        } else {
            tier = 1
        }
        let offset = ranges.first.map { text.distance(from: text.startIndex, to: $0.lowerBound) } ?? 0
        return tier * tierWidth - min(offset, tierWidth - 1)
    }

    /// The score room per tier.
    private static let tierWidth = 1000
}
