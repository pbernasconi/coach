import Foundation

/// Every user intent on the Workout screen, named for what happened (SCR-1).
nonisolated enum WorkoutAction: Equatable, Sendable {
    /// The big check: logs a planned set in one tap, or un-logs a logged or skipped one.
    case setLogTapped(UUID)
    /// The set's weight or reps pill: opens the weight and reps editor.
    case setValuesTapped(UUID)
    case setSkipTapped(UUID)
    case setRemoveTapped(UUID)
    /// Undo on the "Set removed" toast.
    case removeUndoTapped(UUID)
    /// Adds a set to the exercise, copying its last set's target.
    case addSetTapped(exerciseID: UUID)
    case editorWeightChanged(Double)
    case editorRepsChanged(Int)
    /// "Apply to later sets": Done also saves a new weight onto the later planned sets of the same kind.
    case editorApplyToLaterChanged(Bool)
    /// Saves the editor's values without logging the set.
    case editorDoneTapped
    case editorDismissed
    case restExtendTapped
    case restSkipTapped
    /// The How to button or the thumbnail beside an exercise name: opens the library exercise's detail.
    case howToTapped(exerciseID: UUID)
    /// An exercise section with a catalog entry appeared: load its still once.
    case thumbnailNeeded(catalogID: String)
}
