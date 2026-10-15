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

    private static let fruit: [(String, SelectSearch.Candidate)] = [
        ("jar", .init(title: "Mason jars", subtitle: "With blue lids")),
        ("blue", .init(title: "Blueberries", subtitle: "Local punnet, 400 g")),
        ("straw", .init(title: "Strawberries", subtitle: "Boxes from 250 to 500 g")),
        ("elder", .init(title: "Elderberries", subtitle: "Single box, 150 g")),
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
        ("berr", ["blue", "straw", "elder"]),
        ("blue", ["blue", "jar"]),
        ("BLUEBERRIES", ["blue"]),
        ("400 g", ["blue"]),
        ("g", ["blue", "straw", "elder"]),
        ("lids", ["jar"]),
        ("boxes", ["straw"]),
    ])
    func subtitlesMatchButRankBelowTitles(query: String, expected: [String]) {
        #expect(Self.values(Self.fruit, query) == expected)
    }

    @Test func titleMatchingIgnoresDiacriticsAndWordOrder() {
        let options: [(String, SelectSearch.Candidate)] = [
            ("a", .init(title: "Mushroom risotto")),
            ("b", .init(title: "Crème brûlée tarts")),
        ]
        #expect(Self.values(options, "risotto mush") == ["a"])
        #expect(Self.values(options, "creme") == ["b"])
    }

    @Test func resultsCarryTheTitleRangesToHighlight() throws {
        let results = SelectSearch.filter([.init(title: "Strawberry")], query: "berry")
        let result = try #require(results.first)
        #expect(result.titleRanges.map { String("Strawberry"[$0]) } == ["berry"])
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
