import Foundation
import GRDB

/// Row writes for a transaction that changes several rows at once (a session built from a template, a reorder). Each
/// changed row still appends its own outbox entry inside the same transaction (DATA-3).
extension StoreWriter {
    /// Runs `body` in one write transaction with one timestamp.
    func transaction<Value: Sendable>(
        _ body: @escaping @Sendable (Database, Date) throws -> Value
    ) async throws -> Value {
        try await writer.write { db in try body(db, now()) }
    }

    /// Inserts `record` and appends its `.insert` entry.
    func insertRow(_ record: some SyncedRecord, at stamp: Date, _ db: Database) throws {
        try record.insert(db)
        try appendOutbox(record, op: .insert, at: stamp, db)
    }

    /// Stamps `updatedAt`, saves `record` and appends its entry. Returns the saved row.
    @discardableResult
    func updateRow<Record: SyncedRecord>(
        _ record: Record,
        op: OutboxOp = .update,
        at stamp: Date,
        _ db: Database
    ) throws -> Record {
        var saved = record
        saved.updatedAt = stamp
        try saved.update(db)
        try appendOutbox(saved, op: op, at: stamp, db)
        return saved
    }

    /// Sets the tombstone on a live row, or clears it on a removed one; a row already in that state is left alone.
    func setDeleted<Record: SyncedRecord>(_ record: Record, _ isDeleted: Bool, at stamp: Date, _ db: Database) throws {
        guard (record.deletedAt != nil) != isDeleted else { return }
        var changed = record
        changed.deletedAt = isDeleted ? stamp : nil
        try updateRow(changed, op: isDeleted ? .delete : .update, at: stamp, db)
    }
}
