import Foundation

/// One set inside a session exercise, with its target and (once done) its actual.
public struct LoggedSet: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var kind: SetKind
    public var target: SetTarget
    public var actual: SetActual?
    public var note: String?
    public var isSkipped: Bool

    public init(
        id: UUID,
        kind: SetKind = .working,
        target: SetTarget = .none,
        actual: SetActual? = nil,
        note: String? = nil,
        isSkipped: Bool = false
    ) {
        self.id = id
        self.kind = kind
        self.target = target
        self.actual = actual
        self.note = note
        self.isSkipped = isSkipped
    }

    /// Done means an actual was recorded and the set was not skipped.
    public var isDone: Bool { actual != nil && !isSkipped }
}
