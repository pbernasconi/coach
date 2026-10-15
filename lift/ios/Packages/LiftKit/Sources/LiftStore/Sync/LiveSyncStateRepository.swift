import Foundation
import GRDB

/// GRDB-backed `SyncStateRepository`, over the `syncState` table (v2) and the synced tables.
public struct LiveSyncStateRepository: SyncStateRepository {
    private enum Key {
        static let pullCursor = "pullCursor"
        static let deviceID = "deviceID"
        static let lastSyncedAt = "lastSyncedAt"
    }

    private let writer: any DatabaseWriter
    private let makeID: @Sendable () -> UUID

    /// `makeID` is called once per install, for the device id.
    public init(database: LiftDatabase, makeID: @escaping @Sendable () -> UUID) {
        writer = database.writer
        self.makeID = makeID
    }

    public func deviceID() async throws -> UUID {
        let makeID = makeID
        return try await writer.write { db in
            if let text = try Self.value(Key.deviceID, db), let id = UUID(uuidString: text) {
                return id
            }
            let id = makeID()
            try Self.setValue(id.uuidString, for: Key.deviceID, db)
            return id
        }
    }

    public func pullCursor() async throws -> String? {
        try await writer.read { db in try Self.value(Key.pullCursor, db) }
    }

    public func lastSyncedAt() async throws -> Date? {
        let text = try await writer.read { db in try Self.value(Key.lastSyncedAt, db) }
        return text.flatMap(SyncPayload.date(fromWire:))
    }

    public func setLastSyncedAt(_ date: Date) async throws {
        try await writer.write { db in
            try Self.setValue(SyncPayload.wireDate(date), for: Key.lastSyncedAt, db)
        }
    }

    public func apply(_ page: PulledPage) async throws -> PullApplyResult {
        let result = try await writer.write { db in
            var result = try PullApplier.apply(page.changes, db)
            if let cursor = page.cursor, result.deferred.isEmpty || page.isFinal {
                try Self.setValue(cursor, for: Key.pullCursor, db)
                result.storedCursor = true
            }
            return result
        }
        if result.invalid > 0 { SyncStoreLog.pulledRowsSkipped(invalid: result.invalid) }
        if page.isFinal, !result.deferred.isEmpty { SyncStoreLog.pulledRowsOrphaned(result.deferred.count) }
        return result
    }

    private static func value(_ key: String, _ db: Database) throws -> String? {
        try String.fetchOne(db, sql: "SELECT value FROM syncState WHERE key = ?", arguments: [key])
    }

    private static func setValue(_ value: String, for key: String, _ db: Database) throws {
        try db.execute(
            sql: "INSERT INTO syncState (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            arguments: [key, value]
        )
    }
}
