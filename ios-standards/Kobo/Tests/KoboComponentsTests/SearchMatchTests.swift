import Testing

@testable import KoboComponents

/// Token matching, ranges and ranking (extends an earlier app `SearchMatchTests` with diacritics, tokens and scores).
@Suite struct SearchMatchTests {
    private func matched(_ text: String, _ query: String) -> [String] {
        guard let match = SearchMatch(text, query: query) else { return [] }
        return match.ranges.map { String(text[$0]) }
    }

    @Test func matchIsCaseInsensitiveAnywhere() {
        #expect(matched("Avery Johnson", "JOHN") == ["John"])
        #expect(matched("Interest", " int ") == ["Int"])
        #expect(SearchMatch("Avery", query: "zz") == nil)
    }

    @Test func matchIgnoresDiacritics() {
        #expect(matched("Crème brûlée", "creme brulee") == ["Crème", "brûlée"])
        #expect(matched("Cafe", "café") == ["Cafe"])
    }

    @Test func everyTokenMustMatch() {
        #expect(matched("Wild Mushroom Risotto", "risotto mush") == ["Mush", "Risotto"])
        #expect(SearchMatch("Wild Mushroom Risotto", query: "risotto soup") == nil)
    }

    @Test func aBlankQueryMatchesNothing() {
        #expect(SearchMatch("Avery", query: "   ") == nil)
        #expect(SearchMatch.tokens(" a  b ") == ["a", "b"])
    }

    @Test func aWordStartIsPreferredOverAnEarlierMidWordHit() {
        #expect(matched("Pressure press", "press").count == 1)
        let text = "Arrowhead lake"
        let match = SearchMatch(text, query: "head")
        #expect(match.map { String(text[$0.ranges[0]]) } == "head")
    }

    @Test func overlappingRangesMerge() {
        #expect(matched("Basil pesto", "bas basil") == ["Basil"])
    }

    @Test func exactBeatsPrefixBeatsWordStartBeatsInside() {
        let exact = SearchMatch("Tea", query: "tea")?.score ?? 0
        let prefix = SearchMatch("Tea party", query: "tea")?.score ?? 0
        let word = SearchMatch("Green tea", query: "tea")?.score ?? 0
        let inside = SearchMatch("Steam", query: "tea")?.score ?? 0
        #expect(exact > prefix)
        #expect(prefix > word)
        #expect(word > inside)
    }

    @Test func rankedKeepsMatchesBestFirstAndStable() {
        let names = ["Steam", "Green tea", "Tea", "Basil pesto", "Mint tea"]
        let ranked = SearchMatch.ranked(names, query: "tea") { $0 }.map(\.element)
        #expect(ranked == ["Tea", "Mint tea", "Green tea", "Steam"])
        #expect(SearchMatch.ranked(names, query: " ") { $0 }.map(\.element) == names)
    }
}
