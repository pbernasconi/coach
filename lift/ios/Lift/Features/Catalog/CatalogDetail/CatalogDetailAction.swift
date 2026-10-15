import Foundation

/// Every user intent on the catalog detail screen, named for what happened (SCR-1).
nonisolated enum CatalogDetailAction: Equatable, Sendable {
    /// "Add to my exercises".
    case addTapped
    /// "In your library": opens the library exercise.
    case libraryExerciseTapped
}
