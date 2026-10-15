import Foundation

/// The close rule of a sheet or page that edits something: with unsaved changes, a close first asks to discard
/// them. Shared by `KoboSheet`, `ModalPage` and `InputModal`.
nonisolated struct UnsavedChangesGuard: Equatable, Sendable {
    /// True while the "Discard changes?" confirmation shows. The dialog binds it, so it can clear it.
    var isConfirmingDiscard = false

    /// A close was asked for. True when it may close now; false when the confirmation shows instead.
    mutating func requestClose(hasChanges: Bool) -> Bool {
        guard hasChanges else { return true }
        isConfirmingDiscard = true
        return false
    }

    /// The person answered the confirmation, by discarding (the caller then closes) or by keeping their edits.
    mutating func confirmationAnswered() {
        isConfirmingDiscard = false
    }
}
