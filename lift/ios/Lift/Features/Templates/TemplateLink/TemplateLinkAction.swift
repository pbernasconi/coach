import Foundation

/// Every user intent in the template link review, named for what happened (SCR-1).
nonisolated enum TemplateLinkAction: Equatable, Sendable {
    /// The Replace switch of a template whose name already exists.
    case replaceToggled(Int)
    /// "Add N templates".
    case addTapped
    /// Cancel, ✕, a swipe down, or Close on a link that cannot be read.
    case cancelTapped
}
