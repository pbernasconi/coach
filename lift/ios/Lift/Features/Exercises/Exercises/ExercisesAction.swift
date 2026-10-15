import Foundation

/// Every user intent on the Exercises screen, named for what happened (SCR-1).
nonisolated enum ExercisesAction: Equatable, Sendable {
    case queryChanged(String)
    /// A row: opens the exercise's detail.
    case exerciseTapped(UUID)
    /// A row with a catalog entry appeared: load its still once.
    case thumbnailNeeded(catalogID: String)
    /// "All exercises": opens the catalog browse.
    case allExercisesTapped
    /// "Templates": opens the workout templates.
    case templatesTapped
}
