import Foundation
import LiftCore

/// Everything the catalog browse screen renders. Exclusive states are enums (SCR-6).
nonisolated struct CatalogState: Equatable, Sendable {
    var query = ""
    var bodyPart = CatalogChoice.any
    var equipment = CatalogChoice.any
    /// The catalog's body parts and equipment, for the filters.
    var bodyParts: [String] = []
    var equipmentKinds: [String] = []
    /// The entries that match the search and filters, best match first; `.empty` if the catalog has none at all.
    var rows: Loadable<[CatalogRow]> = .loading
    /// How many entries the whole catalog holds.
    var total = 0
    /// Stills requested by rows as they appear, by catalog id.
    var thumbnails: [String: MediaImage] = [:]

    /// Whether the query or a filter narrows the list.
    var isFiltered: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty || bodyPart != .any || equipment != .any
    }
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
        self.init(id: entry.id, name: entry.name, detail: CatalogText.detail(entry))
    }
}
