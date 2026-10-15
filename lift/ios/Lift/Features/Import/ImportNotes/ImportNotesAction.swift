import Foundation

/// Every user intent in the Import from Notes flow, named for what happened (SCR-1).
nonisolated enum ImportNotesAction: Equatable, Sendable {
    case textChanged(String)
    /// "Paste": replaces the text with the clipboard's.
    case pasteTapped
    /// "Review import": reads the note and opens the review step.
    case continueTapped
    /// A workout's checkbox on the review step.
    case sessionToggled(UUID)
    /// The review step's back chevron: returns to the text, unchanged.
    case backTapped
    case importTapped
    /// "Stop import" while writing; what was written stays.
    case stopTapped
    /// "Done" on the outcome.
    case doneTapped
    /// The flow's ✕ (after its leave confirmation when there is text).
    case exitTapped
}
