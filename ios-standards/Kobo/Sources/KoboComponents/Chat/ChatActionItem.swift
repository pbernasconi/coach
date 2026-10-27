import Foundation

/// One proposed change in a `ChatActionCard`: what it does to which thing. A move or an edit can name the value it
/// replaces, which the card shows struck through before the new one ("~~Tue 17:00~~ → Wed 09:00").
nonisolated public struct ChatActionItem: Identifiable, Equatable, Sendable {
    /// What the change does. Each kind has its own glyph and spoken word, so it never reads by colour alone.
    public enum Change: String, Equatable, Sendable, CaseIterable {
        case add
        case remove
        case move
        case edit

        /// The SF Symbol of the change.
        public var systemImage: String {
            switch self {
            case .add: "plus.circle.fill"
            case .remove: "minus.circle.fill"
            case .move: "arrow.right.circle.fill"
            case .edit: "pencil.circle.fill"
            }
        }
    }

    public let id: String
    public let change: Change
    public let title: String
    /// The new value, or a plain caption for an add or a remove.
    public let detail: String?
    /// The value the change replaces; nil for an add or a remove.
    public let previous: String?

    public init(id: String, change: Change, title: String, detail: String? = nil, previous: String? = nil) {
        self.id = id
        self.change = change
        self.title = title
        self.detail = detail
        self.previous = previous
    }
}

/// Where a `ChatActionCard` stands. The card offers its buttons only while `pending`.
nonisolated public enum ChatActionStatus: Equatable, Sendable {
    /// Waiting for the reader: Apply and Dismiss.
    case pending
    /// Apply was tapped and the changes are being made.
    case applying
    /// The changes were made; Undo when the caller can take them back.
    case applied
    /// The changes were made, then taken back.
    case undone
    /// The reader dismissed the proposal.
    case dismissed
    /// A later proposal replaced this one.
    case superseded
    /// Something changed since the proposal was made, so it can no longer apply.
    case expired

    /// Whether the card shows Apply and Dismiss.
    public var showsActions: Bool { self == .pending || self == .applying }
    /// Whether the rows read as current (not dimmed).
    public var isCurrent: Bool { self == .pending || self == .applying || self == .applied }
}
