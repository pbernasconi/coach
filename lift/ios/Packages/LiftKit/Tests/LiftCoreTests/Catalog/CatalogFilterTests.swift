import Foundation
import LiftCore
import Testing

/// Multi-select filters (OR inside a facet, AND across facets) and the option counts, over made-up entries.
@Suite struct CatalogFilterTests {
    let catalog = ExerciseCatalog(
        commit: "c",
        source: "s",
        license: "l",
        attribution: "a",
        entries: [
            CatalogFilterTests.entry("0001", "Made-Up Press", "chest", "pectorals", "barbell"),
            CatalogFilterTests.entry("0002", "Made-Up Fly", "chest", "pectorals", "cable"),
            CatalogFilterTests.entry("0003", "Made-Up Row", "back", "lats", "cable"),
            CatalogFilterTests.entry("0004", "Made-Up Pull", "back", "upper back", "body weight"),
            CatalogFilterTests.entry("0005", "Made-Up Squat", "upper legs", "quads", "barbell"),
        ]
    )

    static func entry(
        _ id: String,
        _ name: String,
        _ bodyPart: String,
        _ target: String,
        _ equipment: String
    )
        -> CatalogExercise
    {
        CatalogExercise(
            id: id,
            name: name,
            category: bodyPart,
            bodyPart: bodyPart,
            equipment: equipment,
            target: target,
            secondary: [],
            muscleGroup: target,
            steps: ["Step."],
            imagePath: "images/\(id).jpg",
            gifPath: "videos/\(id).gif"
        )
    }

    func ids(_ filter: CatalogFilter, query: String = "", library: Set<String> = []) -> [String] {
        catalog.search(query, filter: filter, library: library).map(\.id).sorted()
    }

    @Test func valuesInsideAFacetCombineWithOr() {
        let filter = CatalogFilter(selections: [.bodyPart: ["chest", "back"]])
        #expect(ids(filter) == ["0001", "0002", "0003", "0004"])
    }

    @Test func facetsCombineWithAndAndWithTheQuery() {
        let filter = CatalogFilter(selections: [.bodyPart: ["chest", "back"], .equipment: ["cable"]])
        #expect(ids(filter) == ["0002", "0003"])
        #expect(ids(filter, query: "row") == ["0003"])
    }

    @Test func inLibraryKeepsLinkedEntriesOnly() {
        let filter = CatalogFilter(inLibrary: true)
        #expect(ids(filter, library: ["0005", "0002"]) == ["0002", "0005"])
        #expect(ids(filter).isEmpty)
        #expect(ids(CatalogFilter(), library: ["0005"]).count == 5)
    }

    @Test func toggleAddsAndRemovesAndDropsEmptyFacets() {
        var filter = CatalogFilter()
        filter.toggle("chest", in: .bodyPart)
        filter.toggle("cable", in: .equipment)
        #expect(filter[.bodyPart] == ["chest"])
        #expect(filter.activeCount == 2)
        filter.toggle("chest", in: .bodyPart)
        #expect(filter.selections[.bodyPart] == nil)
        #expect(filter == CatalogFilter(selections: [.equipment: ["cable"], .target: []]))
        filter.inLibrary = true
        #expect(filter.activeCount == 2)
        #expect(!filter.isEmpty)
        #expect(CatalogFilter().isEmpty)
    }

    @Test func countsLeaveTheirOwnFacetOutAndKeepTheOthers() {
        let filter = CatalogFilter(selections: [.bodyPart: ["chest"], .equipment: ["cable"]])
        let counts = catalog.facetCounts("", filter: filter, library: ["0002", "0003"])
        // Body part options under equipment = cable: chest 1 (fly), back 1 (row).
        #expect(counts.count("chest", in: .bodyPart) == 1)
        #expect(counts.count("back", in: .bodyPart) == 1)
        #expect(counts.count("upper legs", in: .bodyPart) == 0)
        // Equipment options under body part = chest.
        #expect(counts.count("barbell", in: .equipment) == 1)
        #expect(counts.count("cable", in: .equipment) == 1)
        #expect(counts.count("body weight", in: .equipment) == 0)
        // Targets keep both facets: only the fly.
        #expect(counts.values[.target] == ["pectorals": 1])
        #expect(counts.inLibrary == 1)
    }

    @Test func countsFollowTheQuery() {
        // "p" starts Press, Pull and the fly's "pectorals".
        let counts = catalog.facetCounts("made up p", filter: CatalogFilter())
        #expect(counts.values[.bodyPart] == ["chest": 2, "back": 1])
        #expect(counts.inLibrary == 0)
    }

    @Test func optionsListEveryValueOfAFacet() {
        #expect(catalog.options(.bodyPart) == ["back", "chest", "upper legs"])
        #expect(catalog.options(.target) == ["lats", "pectorals", "quads", "upper back"])
        #expect(catalog.options(.equipment) == ["barbell", "body weight", "cable"])
    }
}
