import Foundation
import GRDB
import LiftCore

/// GRDB-backed `SessionRepository`.
public struct LiveSessionRepository: SessionRepository {
    private let store: StoreWriter

    public init(database: LiftDatabase, now: @escaping @Sendable () -> Date, makeID: @escaping @Sendable () -> UUID) {
        store = StoreWriter(writer: database.writer, now: now, makeID: makeID)
    }

    public func observeSessions(from first: LocalDay, through last: LocalDay) -> AsyncStream<[SessionDetail]> {
        ObservedStream.make(in: store.writer) { db in
            try SessionQueries.details(db, from: first, through: last)
        }
    }

    public func observeSession(id: UUID) -> AsyncStream<SessionDetail?> {
        ObservedStream.make(in: store.writer) { db in try SessionQueries.detail(db, id: id) }
    }

    public func createSession(on day: LocalDay, title: String, unit: WeightUnit, templateID: UUID?) async throws
        -> SessionRecord
    {
        let id = store.makeID()
        return try await store.insert { _, stamp in
            SessionRecord(
                id: id,
                day: day,
                title: title,
                templateID: templateID,
                unitsAtLog: unit,
                createdAt: stamp,
                updatedAt: stamp
            )
        }
    }

    public func addExercise(_ slot: ExerciseSlot, to sessionID: UUID) async throws -> SessionExerciseRecord {
        let id = store.makeID()
        return try await store.insert { db, stamp in
            _ = try SessionQueries.liveSession(db, id: sessionID)
            let position = try SessionQueries.nextPosition(
                db,
                table: SessionExerciseRecord.databaseTableName,
                parentColumn: "sessionID",
                parentID: sessionID
            )
            return SessionExerciseRecord(
                id: id,
                sessionID: sessionID,
                slot: slot,
                position: position,
                createdAt: stamp,
                updatedAt: stamp
            )
        }
    }

    public func removeExercise(id: UUID) async throws {
        try await store.softDelete(SessionExerciseRecord.self, id: id)
    }

    public func reschedule(_ sessionID: UUID, _ action: RescheduleAction) async throws -> RescheduleUndo {
        let op: OutboxOp = action == .remove ? .delete : .update
        let change = try await store.change(SessionRecord.self, id: sessionID, op: op) { session, stamp in
            switch action {
            case .move(let day): session.day = day
            case .pushToNextWeek: session.day = session.day.adding(days: 7)
            case .remove: session.deletedAt = stamp
            }
        }
        return RescheduleUndo(sessionID: sessionID, previousDay: change.before.day)
    }

    public func undo(_ change: RescheduleUndo) async throws {
        _ = try await store.change(SessionRecord.self, id: change.sessionID, includeDeleted: true) { session, _ in
            session.day = change.previousDay
            session.deletedAt = nil
        }
    }
}
