import Testing

@testable import CraftCatalog

@Suite struct CatalogIndexTests {
    @Test func emptyQueryListsEveryComponentOnce() {
        let listed = CatalogIndex.groups(matching: "").flatMap(\.components)
        #expect(listed.count == CatalogComponent.allCases.count)
        #expect(Set(listed).count == listed.count)
    }

    @Test func sectionsFollowDeclarationOrder() {
        let sections = CatalogIndex.groups(matching: "").map(\.section)
        #expect(sections == CatalogSection.allCases)
    }

    @Test(arguments: [
        ("stepper", [CatalogComponent.stepperField]),
        ("STEPPER", [.stepperField]),
        ("  countdown ", [.countdownRing]),
        ("zzz-no-match", []),
    ])
    func searchMatchesTitleCaseInsensitively(query: String, expected: [CatalogComponent]) {
        #expect(CatalogIndex.groups(matching: query).flatMap(\.components) == expected)
    }

    @Test func searchMatchesSectionAndSummary() {
        let patterns = CatalogIndex.groups(matching: "patterns")
        #expect(patterns.map(\.section) == [.patterns])
        #expect(CatalogIndex.groups(matching: "voiceover").flatMap(\.components).contains(.segmentedPicker))
    }

    @Test func everyComponentHasASummary() {
        for component in CatalogComponent.allCases {
            #expect(!component.summary.isEmpty, "\(component) has no summary")
        }
    }
}
