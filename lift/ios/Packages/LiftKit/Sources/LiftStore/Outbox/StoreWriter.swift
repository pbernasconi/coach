import Foundation
import GRDB
import LiftCore

/// The one way repositories write: each call is a single transaction that changes one row and appends one
/// outbox entry (DATA-3). Time and ids are injected (CONC-5, DATA-2).
struct StoreWriter: Sendable {
    let writer: any DatabaseWriter
    let now: @Sendable () -> Date
    let makeID: @Sendable () -> UUID

    /// Inserts the record `build` makes. `build` may read the database to validate parents.
    func insert<Record: SyncedRecord>(
        _ build: @escaping @Sendable (Database, Date) throws -> Record
    ) async throws -> Record {
        try await writer.write { db in
            let stamp = now()
            let record = try build(db, stamp)
            try record.insert(db)
            try appendOutbox(record, op: .insert, at: stamp, db)
            return record
        }
    }

    /// Changes a live row (or any row with `includeDeleted`) and returns it before and after the change.
    func change<Record: SyncedRecord>(
        _: Record.Type,
        id: UUID,
        op: OutboxOp = .update,
        includeDeleted: Bool = false,
        _ apply: @escaping @Sendable (inout Record, Date) throws -> Void
    ) async throws -> (before: Record, after: Record) {
        try await writer.write { db in
            guard let before = try Record.fetchOne(db, key: id), includeDeleted || before.deletedAt == nil else {
                throw AppError(.notFound, detail: "\(Record.databaseTableName) \(id)")
            }
            let stamp = now()
            var after = before
            try apply(&after, stamp)
            after.updatedAt = Self.stamp(after: before.updatedAt, now: stamp)
            try after.update(db)
            try appendOutbox(after, op: op, at: stamp, db)
            return (before, after)
        }
    }

    /// Soft-deletes a live row: sets the tombstone, never removes it (DATA-2).
    func softDelete<Record: SyncedRecord>(_ type: Record.Type, id: UUID) async throws {
        _ = try await change(type, id: id, op: .delete) { row, stamp in row.deletedAt = stamp }
    }

    /// Clears the tombstone on a soft-deleted row (the Undo of a remove).
    func restore<Record: SyncedRecord>(_ type: Record.Type, id: UUID) async throws {
        _ = try await change(type, id: id, includeDeleted: true) { row, _ in row.deletedAt = nil }
    }

    /// The `updatedAt` for an edit of a row last stamped `previous`: now, or one millisecond past `previous` when
    /// this device's clock is not ahead of it (a version pulled from a device whose clock runs ahead, or two edits
    /// in one millisecond). An edit made after seeing a version then always wins over it under last-writer-wins
    /// (SYNC.md); without this the server kept the older-looking edit out and the devices disagreed for good.
    static func stamp(after previous: Date, now: Date) -> Date {
        // Stored stamps are whole milliseconds; `now` is finer, and storing it rounds or truncates (by platform).
        let last = Int64((previous.timeIntervalSince1970 * 1000).rounded())
        let current = Int64((now.timeIntervalSince1970 * 1000 + 1e-6).rounded(.down))
        if current > last { return now }
        // A quarter past `last + 1`, so storing it gives exactly `last + 1` whether the formatter rounds or truncates.
        return Date(timeIntervalSince1970: (Double(last + 1) + 0.25) / 1000)
    }

    /// Appends the outbox entry for `record` inside the caller's transaction.
    func appendOutbox(_ record: some SyncedRecord, op: OutboxOp, at stamp: Date, _ db: Database) throws {
        let entry = OutboxEntry(
            id: makeID(),
            entity: type(of: record).entity,
            rowID: record.id,
            op: op,
            payload: try OutboxPayload.json(for: record),
            idempotencyKey: makeID(),
            createdAt: stamp
        )
        try entry.insert(db)
    }
}
