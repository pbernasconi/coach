import Foundation
import LiftCore

/// Display text for catalog values, which the dataset writes in lower case ("upper legs", "body weight").
nonisolated enum CatalogText {
    /// "upper legs" → "Upper legs".
    static func label(_ value: String) -> String {
        guard let first = value.first else { return value }
        return first.uppercased() + value.dropFirst()
    }

    /// "Glutes · Barbell": the target muscle, then the equipment.
    static func detail(_ entry: CatalogExercise) -> String {
        "\(label(entry.target)) · \(label(entry.equipment))"
    }

    /// The name of a facet, on its chip and over its options.
    static func title(_ facet: CatalogFacet) -> String {
        switch facet {
        case .bodyPart: String(localized: "Body part")
        case .target: String(localized: "Muscle")
        case .equipment: String(localized: "Equipment")
        }
    }

    /// A filter sheet's title: "Filters", or the facet's name.
    static func title(sheet: CatalogSheet) -> String {
        switch sheet {
        case .all: String(localized: "Filters")
        case .facet(let facet): title(facet)
        }
    }

    /// "1,324 exercises", or "12 of 1,324 exercises" while the search or a filter narrows the list.
    static func count(shown: Int, total: Int, isFiltered: Bool) -> String {
        isFiltered
            ? String(localized: "\(shown) of \(total) exercises")
            : String(localized: "\(total) exercises")
    }
}
