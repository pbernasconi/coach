import Foundation
import GRDB
import LiftCore

/// The Workout screen's edits: notes, restore a removed exercise, reorder, finish.
extension LiveSessionRepository {
    public func saveNote(sessionID: UUID, note: String?) async throws -> SessionRecord {
        try await store.change(SessionRecord.self, id: sessionID) { session, _ in
            session.note = NoteText.normalized(note)
        }
        .after
    }

    public func saveWarmUpNote(sessionID: UUID, note: String?) async throws -> SessionRecord {
        try await store.change(SessionRecord.self, id: sessionID) { session, _ in
            session.warmUpNote = NoteText.normalized(note)
        }
        .after
    }

    public func planWarmUp(sessionID: UUID, gym: GymSetup) async throws {
        let store = store
        try await store.transaction { db, stamp in
            guard let detail = try SessionQueries.detail(db, id: sessionID), detail.session.finishedAt == nil,
                NoteText.normalized(detail.session.warmUpNote) == nil
            else { return }
            let sets = detail.items.flatMap(\.sets)
            guard !sets.contains(where: { $0.kind == .warmUp || $0.status != .planned }) else { return }
            try WarmUpWriter(store: store, db: db, stamp: stamp, gym: gym).plan(sessionID: sessionID)
        }
    }

    public func saveExerciseNote(id: UUID, note: String?) async throws -> SessionExerciseRecord {
        try await store.change(SessionExerciseRecord.self, id: id) { exercise, _ in
            exercise.note = NoteText.normalized(note)
        }
        .after
    }

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
            var session = detail.session.resumed(at: stamp)  // a paused workout finishes with the pause left out
            let firstLogged = detail.items.flatMap(\.sets).filter { $0.status == .done }.compactMap(\.completedAt).min()
            session.startedAt = session.startedAt ?? firstLogged
            session.finishedAt = stamp
            return try store.updateRow(session, at: stamp, db)
        }
    }
}
