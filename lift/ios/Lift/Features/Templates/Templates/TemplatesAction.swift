import Foundation

/// Every user intent on the Templates screen, named for what happened (SCR-1).
nonisolated enum TemplatesAction: Equatable, Sendable {
    /// A row: opens the template's editor.
    case templateTapped(UUID)
    /// "New template": makes an empty template and opens its editor.
    case newTemplateTapped
    /// A row's "…" button: opens its options.
    case optionsTapped(UUID)
    case optionsDismissed
    /// "Remove" in the options: removes at once and offers Undo (product rule).
    case removeTapped(UUID)
    /// Undo on the "Removed" toast.
    case undoRemoveTapped(UUID)
}
