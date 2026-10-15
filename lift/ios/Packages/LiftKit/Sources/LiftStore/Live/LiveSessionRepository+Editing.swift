import Foundation
import GRDB
import LiftCore

/// The Workout screen's edits: restore a removed exercise, reorder, finish.
extension LiveSessionRepository {
    public func restoreExercise(id: UUID) async throws {
        try await store.restore(SessionExerciseRecord.self, id: id)
    }

    public func reorderExercises(in sessionID: UUID, ids: [UUID]) async throws {
        let store = store
        try await store.transaction { db, stamp in
            _ = try SessionQueries.liveSession(db, id: sessionID)
            let exercises =
                try SessionExerciseRecord
                .filter(Column("sessionID") == sessionID)
                .filter(Column.deletedAt == nil)
                .order(Column.position, Column.id)
                .fetchAll(db)
            try Reordering.apply(exercises, ids: ids, store: store, stamp: stamp, db)
        }
    }

    public func finish(sessionID: UUID) async throws -> SessionRecord {
        let store = store
        return try await store.transaction { db, stamp in
            guard let detail = try SessionQueries.detail(db, id: sessionID) else {
                throw AppError(.notFound, detail: "session \(sessionID)")
            }
            var session = detail.session
            let firstLogged = detail.items.flatMap(\.sets).filter { $0.status == .done }.compactMap(\.completedAt).min()
            session.startedAt = session.startedAt ?? firstLogged
            session.finishedAt = stamp
            return try store.updateRow(session, at: stamp, db)
        }
    }
}
