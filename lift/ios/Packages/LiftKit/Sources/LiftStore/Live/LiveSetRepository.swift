import Foundation
import GRDB
import LiftCore

/// GRDB-backed `SetRepository`.
public struct LiveSetRepository: SetRepository {
    private let store: StoreWriter

    public init(database: LiftDatabase, now: @escaping @Sendable () -> Date, makeID: @escaping @Sendable () -> UUID) {
        store = StoreWriter(writer: database.writer, now: now, makeID: makeID)
    }

    public func addSet(to sessionExerciseID: UUID, kind: SetKind, target: SetTarget) async throws -> SetRecord {
        let id = store.makeID()
        return try await store.insert { db, stamp in
            let (exercise, session) = try SessionQueries.liveExercise(db, id: sessionExerciseID)
            let position = try SessionQueries.nextPosition(
                db,
                table: SetRecord.databaseTableName,
                parentColumn: "sessionExerciseID",
                parentID: sessionExerciseID
            )
            return SetRecord(
                id: id,
                sessionExerciseID: sessionExerciseID,
                position: position,
                kind: kind,
                target: target,
                unit: session.unitsAtLog,
                loadMode: exercise.loadMode,
                createdAt: stamp
            )
        }
    }

    public func saveValues(setID: UUID, reps: Int?, weight: Weight?) async throws -> SetRecord {
        try await store.change(SetRecord.self, id: setID) { set, _ in
            set.actualReps = reps
            set.actualWeight = weight?.converted(to: set.unit)
        }
        .after
    }

    public func log(setID: UUID) async throws -> SetRecord {
        try await store.change(SetRecord.self, id: setID) { set, stamp in
            set.actualReps = set.actualReps ?? set.target.reps ?? set.target.repRange?.lowerBound
            set.actualWeight = set.actualWeight ?? set.target.weight
            set.status = .done
            set.completedAt = stamp
        }
        .after
    }

    public func skip(setID: UUID) async throws -> SetRecord {
        try await store.change(SetRecord.self, id: setID) { set, stamp in
            set.status = .skipped
            set.completedAt = stamp
        }
        .after
    }

    public func unlog(setID: UUID) async throws -> SetRecord {
        try await store.change(SetRecord.self, id: setID) { set, _ in
            set.status = .planned
            set.completedAt = nil
        }
        .after
    }

    public func remove(setID: UUID) async throws {
        try await store.softDelete(SetRecord.self, id: setID)
    }

    public func restore(setID: UUID) async throws {
        try await store.restore(SetRecord.self, id: setID)
    }
}
