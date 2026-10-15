import Foundation
import LiftCore

/// Everything the catalog detail screen renders. Exclusive states are enums (SCR-6).
nonisolated struct CatalogDetailState: Equatable, Sendable {
    /// The entry; `.empty` when the catalog has no entry with this id.
    var entry: Loadable<CatalogDetailItem> = .loading
    /// The animation at the top.
    var animation: MediaImage = .loading
    /// Whether the entry is in the person's exercise library.
    var library: CatalogLibraryStatus = .checking
    /// The latest message for the toast slot.
    var toast: CatalogToast?
}

/// The catalog entry as the detail screen shows it.
nonisolated struct CatalogDetailItem: Equatable, Sendable {
    var id: String
    var name: String
    /// "Upper legs".
    var bodyPart: String
    /// "Glutes".
    var target: String
    /// "Quadriceps", "Hamstrings".
    var secondary: [String]
    /// "Barbell".
    var equipment: String
    /// The dataset's steps, in order.
    var steps: [String]

    init(
        id: String,
        name: String,
        bodyPart: String,
        target: String,
        secondary: [String],
        equipment: String,
        steps: [String]
    ) {
        self.id = id
        self.name = name
        self.bodyPart = bodyPart
        self.target = target
        self.secondary = secondary
        self.equipment = equipment
        self.steps = steps
    }

    init(entry: CatalogExercise) {
        self.init(
            id: entry.id,
            name: CatalogText.name(entry.name),
            bodyPart: CatalogText.label(entry.bodyPart),
            target: CatalogText.label(entry.target),
            secondary: entry.secondary.map(CatalogText.label),
            equipment: CatalogText.label(entry.equipment),
            steps: entry.steps
        )
    }
}

/// Whether the entry is already one of the person's exercises.
nonisolated enum CatalogLibraryStatus: Equatable, Sendable {
    /// The library has not been read yet.
    case checking
    /// Not in the library (or archived there): "Add to my exercises".
    case absent
    /// The add is being written.
    case adding
    /// In the library as this exercise: "In your library".
    case present(UUID)
}

/// A short message for the toast slot. `serial` changes with every message, so the same message can show twice.
nonisolated struct CatalogToast: Equatable, Sendable {
    enum Kind: Equatable, Sendable {
        /// The entry was added (or brought back) as a library exercise.
        case added(name: String)
        /// The write failed.
        case failed
    }

    var serial: Int
    var kind: Kind
}
