import Foundation
import LiftCore

/// Every user intent on the catalog detail screen, named for what happened (SCR-1).
nonisolated enum CatalogDetailAction: Equatable, Sendable {
    /// "Add to my exercises".
    case addTapped
    /// "In your library": opens the library exercise.
    case libraryExerciseTapped
    /// The progress range picker: 3M, 6M, 1Y or All.
    case progressRangeChanged(ProgressRange)
    /// The chart was touched at a day (nil once it is let go).
    case progressSelectionChanged(Date?)
}
