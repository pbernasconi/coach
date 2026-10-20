import Foundation
import LiftStore

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
    /// An RPE chip in the editor; tapping the chip already chosen clears the RPE.
    case editorRPEChanged(Double)
    case editorNoteChanged(String)
    /// "Apply to later sets": Done also saves a new weight onto the later planned sets of the same kind.
    case editorApplyToLaterChanged(Bool)
    /// Saves the editor's values, RPE and note without logging the set.
    case editorDoneTapped
    case editorDismissed
    /// "Add note" or the note under the header: opens the note editor for the whole session.
    case sessionNoteTapped
    /// "Add note" or "Edit note" in an exercise's options: opens the note editor for that exercise.
    case exerciseNoteTapped(UUID)
    case noteTextChanged(String)
    /// Saves the note; an empty one clears it.
    case noteDoneTapped
    case noteDismissed
    case restExtendTapped
    case restSkipTapped
    /// The close button on the "rest over" bar: hides it without logging anything.
    case restReadyDismissed
    /// The How to button or the thumbnail beside an exercise name: opens the library exercise's detail.
    case howToTapped(exerciseID: UUID)
    /// An exercise section with a catalog entry appeared: load its still once.
    case thumbnailNeeded(catalogID: String)
    /// "Add exercise": opens the exercise picker for this session.
    case addExerciseTapped
    /// The "…" in the navigation bar: Save as template and Discard workout.
    case workoutOptionsTapped
    /// An exercise's "…": move it or remove it.
    case exerciseOptionsTapped(UUID)
    case optionsDismissed
    case exerciseMoveUpTapped(UUID)
    case exerciseMoveDownTapped(UUID)
    /// Removes the exercise at once and offers Undo (product rule).
    case exerciseRemoveTapped(UUID)
    /// Undo on the "Exercise removed" toast.
    case exerciseRemoveUndoTapped(UUID)
    /// "Start workout" on a session nobody started: stamps the start now, and the header clock runs from it. Logging
    /// the first set starts it too.
    case startTapped
    /// Marks the session finished (planned sets stay planned) and opens its summary.
    case finishTapped
    /// "View summary" on a finished session.
    case summaryTapped
    /// Removes the session at once; the toast offers Undo. The only destructive path on this screen.
    case discardTapped
    /// Undo on the "Workout discarded" toast, which stays up after the page closes.
    case discardUndoTapped(RescheduleUndo)
    /// The "Workout discarded" toast is up: the page closes, back to where it was opened from.
    case discardedToastShown
    /// A new template from this session's exercises, named like it.
    case saveAsTemplateTapped
}
