import Testing

@testable import KoboComponents

/// Token matching, ranges and ranking (extends Trellis `SearchMatchTests` with diacritics, tokens and scores).
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
        #expect(matched("Incline Bench Press", "bench inc") == ["Inc", "Bench"])
        #expect(SearchMatch("Incline Bench Press", query: "bench squat") == nil)
    }

    @Test func aBlankQueryMatchesNothing() {
        #expect(SearchMatch("Avery", query: "   ") == nil)
        #expect(SearchMatch.tokens(" a  b ") == ["a", "b"])
    }

    @Test func aWordStartIsPreferredOverAnEarlierMidWordHit() {
        #expect(matched("Pressure press", "press").count == 1)
        let text = "Overhead press"
        let match = SearchMatch(text, query: "head")
        #expect(match.map { String(text[$0.ranges[0]]) } == "head")
    }

    @Test func overlappingRangesMerge() {
        #expect(matched("Bench press", "ben bench") == ["Bench"])
    }

    @Test func exactBeatsPrefixBeatsWordStartBeatsInside() {
        let exact = SearchMatch("Squat", query: "squat")?.score ?? 0
        let prefix = SearchMatch("Squat jump", query: "squat")?.score ?? 0
        let word = SearchMatch("Front squat", query: "squat")?.score ?? 0
        let inside = SearchMatch("Backsquat", query: "squat")?.score ?? 0
        #expect(exact > prefix)
        #expect(prefix > word)
        #expect(word > inside)
    }

    @Test func rankedKeepsMatchesBestFirstAndStable() {
        let names = ["Backsquat", "Front squat", "Squat", "Bench press", "Box squat"]
        let ranked = SearchMatch.ranked(names, query: "squat") { $0 }.map(\.element)
        #expect(ranked == ["Squat", "Box squat", "Front squat", "Backsquat"])
        #expect(SearchMatch.ranked(names, query: " ") { $0 }.map(\.element) == names)
    }
}
