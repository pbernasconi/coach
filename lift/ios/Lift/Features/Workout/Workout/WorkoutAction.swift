import Foundation

/// Every user intent on the Workout screen, named for what happened (SCR-1).
nonisolated enum WorkoutAction: Equatable, Sendable {
    /// The big check: logs a planned set in one tap, or un-logs a logged or skipped one.
    case setLogTapped(UUID)
    /// The set's values: opens the weight and reps editor.
    case setValuesTapped(UUID)
    case setSkipTapped(UUID)
    case setRemoveTapped(UUID)
    /// Undo on the "Set removed" toast.
    case removeUndoTapped(UUID)
    /// Adds a set to the exercise, copying its last set's target.
    case addSetTapped(exerciseID: UUID)
    case editorWeightChanged(Double)
    case editorRepsChanged(Int)
    /// Saves the editor's values without logging the set.
    case editorDoneTapped
    case editorDismissed
    case restExtendTapped
    case restSkipTapped
    /// "How to" beside an exercise name: opens the library exercise's detail.
    case howToTapped(exerciseID: UUID)
}
