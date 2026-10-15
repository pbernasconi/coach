import Foundation
import GRDB
import LiftCore

/// Applies pulled rows inside the caller's transaction (SYNC.md). Rows are written with plain GRDB
/// persistence, never through `StoreWriter`, so no outbox entry is appended.
enum PullApplier {
    enum Outcome: Equatable {
        case applied, stale, invalid, deferred
    }

    /// Applies `changes` parents first, so a page that holds a session and its sets satisfies the foreign keys.
    static func apply(_ changes: [RemoteChange], _ db: Database) throws -> PullApplyResult {
        var result = PullApplyResult()
        let ordered = changes.enumerated().sorted { lhs, rhs in
            (rank(lhs.element.entity), lhs.offset) < (rank(rhs.element.entity), rhs.offset)
        }
        for (_, change) in ordered {
            switch try apply(change, db) {
            case .applied: result.applied += 1
            case .stale: result.stale += 1
            case .invalid: result.invalid += 1
            case .deferred: result.deferred.append(change)
            }
        }
        return result
    }

    private static func rank(_ entity: OutboxEntity) -> Int {
        switch entity {
        case .exercise: 0
        case .session: 1
        case .sessionExercise: 2
        case .set: 3
        }
    }

    private static func apply(_ change: RemoteChange, _ db: Database) throws -> Outcome {
        switch change.entity {
        case .exercise:
            return try upsert(ExerciseRow.self, change, db) { _ in true }
        case .session:
            return try upsert(SessionRecord.self, change, db) { _ in true }
        case .sessionExercise:
            return try upsert(SessionExerciseRecord.self, change, db) { row in
                try SessionRecord.exists(db, key: row.sessionID)
            }
        case .set:
            return try upsert(SetRecord.self, change, db) { row in
                try SessionExerciseRecord.exists(db, key: row.sessionExerciseID)
            }
        }
    }

    /// Inserts the row, or overwrites it when the remote `updatedAt` is newer. Equal stamps are a no-op, so
    /// re-applying a page (or the echo of this device's own push) changes nothing.
    private static func upsert<Record: SyncedRecord>(
        _: Record.Type,
        _ change: RemoteChange,
        _ db: Database,
        hasParent: (Record) throws -> Bool
    ) throws -> Outcome {
        let incoming: Record
        do {
            incoming = try Record(row: SyncPayload.row(from: change.payload))
        } catch {
            return .invalid
        }
        guard incoming.id == change.rowID else { return .invalid }
        guard try hasParent(incoming) else { return .deferred }
        guard let existing = try Record.fetchOne(db, key: incoming.id) else {
            try incoming.insert(db)
            return .applied
        }
        guard milliseconds(incoming.updatedAt) > milliseconds(existing.updatedAt) else { return .stale }
        try incoming.update(db)
        return .applied
    }

    /// Stamps are stored to the millisecond; compare at that precision so a round trip is never "newer".
    private static func milliseconds(_ date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1000).rounded())
    }
}
