import Foundation
import LiftCore

/// Everything the Exercises screen renders. Exclusive states are enums (SCR-6).
nonisolated struct ExercisesState: Equatable, Sendable {
    var query = ""
    /// The whole library (archived exercises left out), sorted by name.
    var exercises: Loadable<[ExerciseItem]> = .loading
    /// Exercise stills by catalog id, loaded as rows appear.
    var thumbnails: [String: MediaImage] = [:]

    /// The exercises that match `query`; all of them when it is blank.
    var visible: [ExerciseItem] {
        guard case .loaded(let items) = exercises else { return [] }
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return items }
        return items.filter { $0.matches(query) }
    }
}

/// One library exercise as the list shows it.
nonisolated struct ExerciseItem: Equatable, Sendable, Identifiable {
    var id: UUID
    var name: String
    var aliases: [String]
    /// "Barbell · Quads, Glutes".
    var detail: String
    /// The catalog entry, for the thumbnail; nil for an exercise the person made up.
    var catalogID: String?

    init(id: UUID, name: String, aliases: [String], detail: String, catalogID: String? = nil) {
        self.id = id
        self.name = name
        self.aliases = aliases
        self.detail = detail
        self.catalogID = catalogID
    }

    init(exercise: Exercise) {
        self.init(
            id: exercise.id,
            name: exercise.name,
            aliases: exercise.aliases,
            detail: ExerciseText.detail(equipment: exercise.equipment, primary: exercise.primary),
            catalogID: exercise.catalogID
        )
    }

    /// True when the name or an alias contains `query`, ignoring case and accents.
    func matches(_ query: String) -> Bool {
        let options: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]
        return ([name] + aliases).contains { $0.range(of: query, options: options) != nil }
    }
}
