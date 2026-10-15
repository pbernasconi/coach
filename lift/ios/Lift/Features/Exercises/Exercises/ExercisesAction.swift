/// Every user intent on the Exercises screen, named for what happened (SCR-1).
nonisolated enum ExercisesAction: Equatable, Sendable {
    case queryChanged(String)
}
