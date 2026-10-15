import Foundation

/// The result of importing pasted Apple Notes text.
public struct NotesImport: Hashable, Sendable {
    public let sessions: [Session]
    /// Problems, in line order.
    public let issues: [ImportIssue]

    public init(sessions: [Session], issues: [ImportIssue]) {
        self.sessions = sessions
        self.issues = issues
    }

    /// Done sets across every session, for a quick sanity check after import.
    public var doneSetCount: Int { sessions.reduce(0) { $0 + $1.allSets.filter(\.isDone).count } }
}
