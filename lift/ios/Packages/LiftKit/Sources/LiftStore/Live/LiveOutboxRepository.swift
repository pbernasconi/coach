import Foundation
import GRDB

/// GRDB-backed `OutboxRepository`.
public struct LiveOutboxRepository: OutboxRepository {
    private let writer: any DatabaseWriter

    public init(database: LiftDatabase) {
        writer = database.writer
    }

    public func pending(limit: Int) async throws -> [OutboxEntry] {
        try await writer.read { db in
            // Write order. `_rowid_`, not `rowid`: the table's own `rowID` column (the changed row's id) shadows `rowid`.
            try OutboxEntry.order(Column("_rowid_")).limit(limit).fetchAll(db)
        }
    }

    public func observePendingCount() -> AsyncStream<Int> {
        ObservedStream.make(in: writer) { db in try OutboxEntry.fetchCount(db) }
    }

    public func acknowledge(_ ids: [UUID]) async throws {
        _ = try await writer.write { db in
            try OutboxEntry.filter(keys: ids).deleteAll(db)
        }
    }
}
