import Foundation
import GRDB

/// The table an outbox entry describes.
public enum OutboxEntity: String, Codable, Hashable, Sendable, CaseIterable {
    case exercise
    case session
    case sessionExercise
    case set
    case template
    case templateExercise
    /// The workout timeline (v10).
    case workoutEvent
}

/// What happened to the row. A soft delete is `.delete`; the payload still carries the whole row.
public enum OutboxOp: String, Codable, Hashable, Sendable, CaseIterable {
    case insert
    case update
    case delete
}

/// One pending change for the sync engine to push (DATA-3). `payload` is the full row as JSON, column for
/// column, so the server can apply last-writer-wins per row. Entries are removed only after the server
/// acknowledges them, which is the one place rows are hard-deleted.
public struct OutboxEntry: Hashable, Sendable, Identifiable {
    public var id: UUID
    public var entity: OutboxEntity
    public var rowID: UUID
    public var op: OutboxOp
    public var payload: String
    public var idempotencyKey: UUID
    public var createdAt: Date

    public init(
        id: UUID,
        entity: OutboxEntity,
        rowID: UUID,
        op: OutboxOp,
        payload: String,
        idempotencyKey: UUID,
        createdAt: Date
    ) {
        self.id = id
        self.entity = entity
        self.rowID = rowID
        self.op = op
        self.payload = payload
        self.idempotencyKey = idempotencyKey
        self.createdAt = createdAt
    }
}

extension OutboxEntry: FetchableRecord, PersistableRecord {
    public static let databaseTableName = "outbox"

    public init(row: Row) throws {
        id = try row.required("id")
        entity = try row.raw("entity")
        rowID = try row.required("rowID")
        op = try row.raw("op")
        payload = try row.required("payload")
        idempotencyKey = try row.required("idempotencyKey")
        createdAt = try row.required("createdAt")
    }

    public func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["entity"] = entity.rawValue
        container["rowID"] = rowID
        container["op"] = op.rawValue
        container["payload"] = payload
        container["idempotencyKey"] = idempotencyKey
        container["createdAt"] = createdAt
    }
}
