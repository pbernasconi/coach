import Foundation
import LiftStore

/// The push body (SYNC.md). Keys match the contract exactly; ids are UUID strings.
public struct PushRequest: Codable, Hashable, Sendable {
    public var deviceId: String
    public var changes: [PushChange]

    public init(deviceId: String, changes: [PushChange]) {
        self.deviceId = deviceId
        self.changes = changes
    }
}

/// One outbox entry on the wire.
public struct PushChange: Codable, Hashable, Sendable {
    public var idempotencyKey: String
    public var entity: OutboxEntity
    public var rowId: String
    public var op: OutboxOp
    public var payload: [String: JSONValue]

    public init(idempotencyKey: String, entity: OutboxEntity, rowId: String, op: OutboxOp, payload: [String: JSONValue]) {
        self.idempotencyKey = idempotencyKey
        self.entity = entity
        self.rowId = rowId
        self.op = op
        self.payload = payload
    }

    /// The wire form of an outbox entry, with its dates converted to ISO 8601.
    public init(entry: OutboxEntry) throws {
        self.init(
            idempotencyKey: entry.idempotencyKey.uuidString,
            entity: entry.entity,
            rowId: entry.rowID.uuidString,
            op: entry.op,
            payload: try SyncPayload.wireObject(outboxPayload: entry.payload)
        )
    }
}

/// The push response. Keys are matched as UUIDs, so the server may echo them in any letter case.
public struct PushResponse: Codable, Hashable, Sendable {
    public struct Rejection: Codable, Hashable, Sendable {
        public var idempotencyKey: String
        public var reason: String

        public init(idempotencyKey: String, reason: String) {
            self.idempotencyKey = idempotencyKey
            self.reason = reason
        }
    }

    public var accepted: [String]
    public var rejected: [Rejection]

    public init(accepted: [String], rejected: [Rejection] = []) {
        self.accepted = accepted
        self.rejected = rejected
    }

    /// Every key the server acknowledged, accepted or rejected (both leave the outbox).
    public var acknowledgedKeys: Set<UUID> {
        Set((accepted + rejected.map(\.idempotencyKey)).compactMap(UUID.init(uuidString:)))
    }
}

/// The pull response. Decoded tolerantly (NET-4): a change with an unknown entity or a bad id is dropped
/// instead of failing the page.
public struct PullResponse: Codable, Hashable, Sendable {
    public var changes: [RemoteChange]
    public var cursor: String?
    public var hasMore: Bool

    private enum CodingKeys: String, CodingKey {
        case changes, cursor, hasMore
    }

    public init(changes: [RemoteChange], cursor: String?, hasMore: Bool) {
        self.changes = changes
        self.cursor = cursor
        self.hasMore = hasMore
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let wire = try container.decode([LossyChange].self, forKey: .changes)
        changes = wire.compactMap(\.change)
        cursor = try container.decodeIfPresent(String.self, forKey: .cursor)
        hasMore = try container.decode(Bool.self, forKey: .hasMore)
        droppedCount = wire.count - changes.count
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(changes.map(LossyChange.init), forKey: .changes)
        try container.encode(cursor, forKey: .cursor)
        try container.encode(hasMore, forKey: .hasMore)
    }

    /// How many wire changes were dropped while decoding.
    public private(set) var droppedCount = 0
}

/// One pulled change; `change` is nil when the entity is unknown or the row id is not a UUID.
private struct LossyChange: Codable {
    var change: RemoteChange?

    private enum CodingKeys: String, CodingKey {
        case entity, rowId, payload
    }

    init(_ change: RemoteChange) {
        self.change = change
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let entity = (try? container.decode(String.self, forKey: .entity)).flatMap(OutboxEntity.init(rawValue:))
        let rowID = (try? container.decode(String.self, forKey: .rowId)).flatMap(UUID.init(uuidString:))
        let payload = try? container.decode([String: JSONValue].self, forKey: .payload)
        guard let entity, let rowID, let payload else { return }
        change = RemoteChange(entity: entity, rowID: rowID, payload: payload)
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(change?.entity.rawValue, forKey: .entity)
        try container.encodeIfPresent(change?.rowID.uuidString, forKey: .rowId)
        try container.encodeIfPresent(change?.payload, forKey: .payload)
    }
}
