import Foundation

/// One change in a `ChangeSetCard`: something added, removed or changed, said in a title and an optional detail.
///
///     ChangeItem(.changed, title: "Team sync", detail: "Tue → Wed 10:00")
nonisolated public struct ChangeItem: Identifiable, Equatable, Sendable {
    /// What happens to the thing the row names.
    public enum Kind: Sendable, Equatable, CaseIterable {
        case added
        case removed
        case changed
    }

    public let id: String
    public let kind: Kind
    public let title: String
    public let detail: String?

    public init(_ kind: Kind, title: String, detail: String? = nil, id: String? = nil) {
        self.kind = kind
        self.title = title
        self.detail = detail
        self.id = id ?? "\(kind)-\(title)-\(detail ?? "")"
    }
}

/// Where a proposed change set is in its life. The card's buttons follow from it (`actions`).
nonisolated public enum ChangeSetPhase: Equatable, Sendable {
    /// Waiting for a decision: Apply or Dismiss.
    case proposed
    /// Apply was tapped and the write is running.
    case applying
    /// Written. Undo shows while the caller still offers it.
    case applied
    /// Turned down.
    case dismissed
    /// What it would change has changed since, so it can no longer be applied as is.
    case outdated

    /// A button the card shows.
    enum Action: Hashable { case apply, dismiss, undo }

    /// The card's buttons in this phase. Applying shows Apply as busy, so its place does not jump.
    func actions(canUndo: Bool) -> [Action] {
        switch self {
        case .proposed, .applying: [.dismiss, .apply]
        case .applied: canUndo ? [.undo] : []
        case .dismissed, .outdated: []
        }
    }
}
