import Foundation
import LiftCore

/// Everything the catalog browse screen renders. Exclusive states are enums (SCR-6).
nonisolated struct CatalogState: Equatable, Sendable {
    var query = ""
    /// The chosen filters: OR inside a facet, AND across facets.
    var filter = CatalogFilter()
    /// Every value of each facet in the catalog, sorted, for the filter sheets.
    var options: [CatalogFacet: [String]] = [:]
    /// How many entries each option would show with the query and the other filters.
    var counts = CatalogFacetCounts()
    /// Catalog ids the library links to; "In my library" is offered while it is not empty.
    var library: Set<String> = []
    /// The entries that match the search and filters, best match first; `.empty` if the catalog has none at all.
    var rows: Loadable<[CatalogRow]> = .loading
    /// How many entries the whole catalog holds.
    var total = 0
    /// Stills requested by rows as they appear, by catalog id.
    var thumbnails: [String: MediaImage] = [:]
    /// The open filter sheet, if any.
    var sheet: CatalogSheet?

    /// Whether the query or a filter narrows the list.
    var isFiltered: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty || !filter.isEmpty
    }

    /// How many entries the list shows.
    var resultCount: Int {
        if case .loaded(let rows) = rows { return rows.count }
        return 0
    }

    /// The chosen values of a facet as labels, in the sheet's order.
    func chosenLabels(_ facet: CatalogFacet) -> [String] {
        let chosen = filter[facet]
        return (options[facet] ?? []).filter(chosen.contains).map(CatalogText.label)
    }

    /// A facet's options as a sheet lists them: every value, with its count and whether it is chosen.
    func choices(_ facet: CatalogFacet) -> [CatalogChoice] {
        let chosen = filter[facet]
        return (options[facet] ?? []).map { value in
            CatalogChoice(
                value: value,
                count: counts.count(value, in: facet),
                isOn: chosen.contains(value)
            )
        }
    }
}

/// One option in a filter sheet.
nonisolated struct CatalogChoice: Equatable, Sendable, Identifiable {
    /// The dataset value ("upper legs").
    var value: String
    /// Entries it would show with the query and the other filters.
    var count: Int
    var isOn: Bool

    var id: String { value }
}

/// A filter sheet: every filter at once, or one facet.
nonisolated enum CatalogSheet: Hashable, Sendable, Identifiable {
    case all
    case facet(CatalogFacet)

    var id: Self { self }
}

/// One catalog entry as the list shows it.
nonisolated struct CatalogRow: Equatable, Sendable, Identifiable {
    /// The dataset id.
    var id: String
    var name: String
    /// "Glutes · Barbell".
    var detail: String

    init(id: String, name: String, detail: String) {
        self.id = id
        self.name = name
        self.detail = detail
    }

    init(entry: CatalogExercise) {
        self.init(id: entry.id, name: CatalogText.name(entry.name), detail: CatalogText.detail(entry))
    }
}
