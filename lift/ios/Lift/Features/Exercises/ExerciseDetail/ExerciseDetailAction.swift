/// Every user intent on the exercise detail screen, named for what happened (SCR-1).
nonisolated enum ExerciseDetailAction: Equatable, Sendable {
    /// "Watch technique videos": opens a YouTube search (or the pinned video).
    case videosTapped
    /// "From the exercise library": shows or hides the catalog's steps.
    case libraryStepsExpandedChanged(Bool)
}
