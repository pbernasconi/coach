import Foundation

/// One section of the catalog list with the components that match the current search.
nonisolated public struct CatalogGroup: Identifiable, Equatable, Sendable {
    public let section: CatalogSection
    public let components: [CatalogComponent]

    public var id: CatalogSection { section }
}

/// Pure search and grouping for the catalog, kept out of the view so it can be tested.
nonisolated public enum CatalogIndex {
    /// Groups components by section in declaration order, keeping only those matching `query`
    /// (case- and diacritic-insensitive, on title, section or summary). Empty sections are dropped.
    public static func groups(
        matching query: String,
        in components: [CatalogComponent] = CatalogComponent.allCases
    ) -> [CatalogGroup] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let matches = components.filter { needle.isEmpty || matchesQuery($0, needle) }
        return CatalogSection.allCases.compactMap { section in
            let inSection = matches.filter { $0.section == section }
            return inSection.isEmpty ? nil : CatalogGroup(section: section, components: inSection)
        }
    }

    static func matchesQuery(_ component: CatalogComponent, _ needle: String) -> Bool {
        let options: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]
        return [component.title, component.section.rawValue, component.summary]
            .contains { $0.range(of: needle, options: options) != nil }
    }
}
