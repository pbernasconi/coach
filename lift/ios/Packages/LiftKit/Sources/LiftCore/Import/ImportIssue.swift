import Foundation

/// A line the importer could not turn into data. Nothing is dropped silently: such lines end up here or in
/// a session or exercise note.
public struct ImportIssue: Hashable, Sendable {
    public enum Kind: String, Hashable, Sendable {
        /// Text before the first session title line.
        case outsideSession
        /// An exercise header with no set lines under it.
        case headerWithoutSets
        /// A set line with no exercise header above it.
        case setWithoutExercise
        /// A title line whose date does not exist (for example Feb 30); the session uses the reference day.
        case invalidDate
        /// Anything else the importer could not read.
        case unrecognized
    }

    /// 1-based line number in the pasted text.
    public let line: Int
    public let kind: Kind
    /// The line as read (trimmed).
    public let text: String

    public init(line: Int, kind: Kind, text: String) {
        self.line = line
        self.kind = kind
        self.text = text
    }
}
