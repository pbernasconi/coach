import Foundation
import LiftCore

/// Everything the exercise picker renders. Exclusive states are enums or optionals (SCR-6).
nonisolated struct ExercisePickerState: Equatable, Sendable {
    /// Where the rows come from.
    enum Source: String, Equatable, Sendable, Hashable {
        /// The person's library.
        case library
        /// The bundled catalog.
        case catalog
    }

    /// A row being added; further taps wait until it is done.
    enum Pick: Equatable, Sendable {
        case library(UUID)
        case catalog(String)
    }

    var query = ""
    var source = Source.library
    /// The library (archived exercises left out), sorted by name.
    var library: Loadable<[ExerciseItem]> = .loading
    /// The catalog entries that match the query, best match first.
    var catalog: Loadable<[CatalogRow]> = .loading
    /// Stills by catalog id, loaded as rows appear.
    var thumbnails: [String: MediaImage] = [:]
    var adding: Pick?
    /// Counts failed adds; each new value shows the "could not add" toast.
    var failures = 0

    /// The library rows that match `query`; all of them when it is blank.
    var visibleLibrary: [ExerciseItem] {
        guard case .loaded(let items) = library else { return [] }
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return items }
        return items.filter { $0.matches(query) }
    }
}
