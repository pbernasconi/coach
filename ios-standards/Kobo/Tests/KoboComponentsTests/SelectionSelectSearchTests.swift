import Testing

@testable import KoboComponents

/// Ported from an earlier app's `SelectSearchVectorsTests` (shared vectors: select-search.json), plus Kobo's
/// word-by-word, diacritic-insensitive title matching.
@Suite struct SelectionSelectSearchTests {
    private static let countries: [(String, SelectSearch.Candidate)] = [
        ("KH", .init(title: "Cambodia", keywords: ["KH"])),
        ("TD", .init(title: "Chad", keywords: ["TD"])),
        ("CL", .init(title: "Chile", keywords: ["CL"])),
        ("CN", .init(title: "China", keywords: ["CN"])),
        ("CZ", .init(title: "Czechia", keywords: ["CZ"])),
        ("CH", .init(title: "Switzerland", keywords: ["CH"])),
    ]

    private static let equipment: [(String, SelectSearch.Candidate)] = [
        ("plate", .init(title: "Bumper plates", subtitle: "Load them on the bar")),
        ("bar", .init(title: "Barbell", subtitle: "Olympic bar, 20 kg")),
        ("db", .init(title: "Dumbbells", subtitle: "Pairs from 2 to 40 kg")),
        ("kb", .init(title: "Kettlebell", subtitle: "Single bell, 16 kg")),
    ]

    private static func values(_ set: [(String, SelectSearch.Candidate)], _ query: String) -> [String] {
        SelectSearch.filter(set.map(\.1), query: query).map { set[$0.index].0 }
    }

    @Test(arguments: [
        ("", ["KH", "TD", "CL", "CN", "CZ", "CH"]),
        ("   ", ["KH", "TD", "CL", "CN", "CZ", "CH"]),
        ("ch", ["CH", "TD", "CL", "CN", "CZ"]),
        (" CH ", ["CH", "TD", "CL", "CN", "CZ"]),
        ("c", ["KH", "TD", "CL", "CN", "CZ", "CH"]),
        ("zech", ["CZ"]),
        ("zz", []),
    ])
    func countryRankingMatchesTheVectors(query: String, expected: [String]) {
        #expect(Self.values(Self.countries, query) == expected)
    }

    @Test(arguments: [
        ("bell", ["bar", "db", "kb"]),
        ("bar", ["bar", "plate"]),
        ("BARBELL", ["bar"]),
        ("20 kg", ["bar"]),
        ("kg", ["bar", "db", "kb"]),
        ("load", ["plate"]),
        ("pairs", ["db"]),
    ])
    func subtitlesMatchButRankBelowTitles(query: String, expected: [String]) {
        #expect(Self.values(Self.equipment, query) == expected)
    }

    @Test func titleMatchingIgnoresDiacriticsAndWordOrder() {
        let options: [(String, SelectSearch.Candidate)] = [
            ("a", .init(title: "Incline bench press")),
            ("b", .init(title: "Crème brûlée curls")),
        ]
        #expect(Self.values(options, "bench inc") == ["a"])
        #expect(Self.values(options, "creme") == ["b"])
    }

    @Test func resultsCarryTheTitleRangesToHighlight() throws {
        let results = SelectSearch.filter([.init(title: "Barbell")], query: "bell")
        let result = try #require(results.first)
        #expect(result.titleRanges.map { String("Barbell"[$0]) } == ["bell"])
    }

    @Test func searchTurnsOnAtTheThresholdUnlessTheCallerDecides() {
        let threshold = SelectSearch.autoThreshold
        #expect(threshold == 8)
        #expect(!SelectSearch.isEnabled(.automatic, optionCount: threshold - 1))
        #expect(SelectSearch.isEnabled(.automatic, optionCount: threshold))
        #expect(SelectSearch.isEnabled(.shown, optionCount: 0))
        #expect(!SelectSearch.isEnabled(.hidden, optionCount: 100))
    }
}
