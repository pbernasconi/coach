import Foundation

/// Every user intent on the template editor, named for what happened (SCR-1).
nonisolated enum TemplateEditorAction: Equatable, Sendable {
    case nameChanged(String)
    /// Return in the name field, or leaving the screen: saves the name.
    case nameCommitted
    /// A slot row: opens its editor sheet.
    case slotTapped(UUID)
    /// "Add exercise": opens the exercise picker.
    case addExerciseTapped
    case editorSetsChanged(Int)
    case editorRepMinChanged(Int)
    case editorRepMaxChanged(Int)
    case editorWeightChanged(Double)
    case editorRestChanged(Int)
    /// Saves the slot's values.
    case editorDoneTapped
    case editorDismissed
    case moveUpTapped(UUID)
    case moveDownTapped(UUID)
    /// Removes the slot at once and offers Undo (product rule).
    case removeTapped(UUID)
    /// Undo on the "Exercise removed" toast.
    case removeUndoTapped(UUID)
}
