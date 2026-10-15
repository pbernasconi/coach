import Foundation
import GRDB
import LiftCore

/// GRDB-backed `ExerciseRepository`.
public struct LiveExerciseRepository: ExerciseRepository {
    private let store: StoreWriter

    public init(database: LiftDatabase, now: @escaping @Sendable () -> Date, makeID: @escaping @Sendable () -> UUID) {
        store = StoreWriter(writer: database.writer, now: now, makeID: makeID)
    }

    public func observeExercises() -> AsyncStream<[Exercise]> {
        ObservedStream.make(in: store.writer) { db in
            try ExerciseRow
                .filter(Column.deletedAt == nil)
                .order(Column("name").collating(.nocase), Column.id)
                .fetchAll(db)
                .map(\.exercise)
        }
    }

    public func create(
        name: String,
        equipment: Equipment,
        loadMode: LoadMode,
        primary: [Muscle],
        secondary: [Muscle]
    ) async throws -> Exercise {
        let id = store.makeID()
        let row = try await store.insert { _, stamp in
            ExerciseRow(
                exercise: Exercise(
                    id: id,
                    name: name,
                    equipment: equipment,
                    loadMode: loadMode,
                    primary: primary,
                    secondary: secondary,
                    createdAt: stamp,
                    updatedAt: stamp
                )
            )
        }
        return row.exercise
    }

    public func update(_ exercise: Exercise) async throws -> Exercise {
        let change = try await store.change(ExerciseRow.self, id: exercise.id) { row, _ in
            var edited = exercise
            edited.createdAt = row.exercise.createdAt
            edited.deletedAt = row.exercise.deletedAt
            row.exercise = edited
        }
        return change.after.exercise
    }

    public func remove(id: UUID) async throws {
        try await store.softDelete(ExerciseRow.self, id: id)
    }

    public func restore(id: UUID) async throws {
        try await store.restore(ExerciseRow.self, id: id)
    }

    public func installLibrary() async throws -> Int {
        let store = store
        return try await store.writer.write { db in
            let existing = try Set(UUID.fetchAll(db, ExerciseRow.select(Column.id)))
            let missing = ExerciseLibrary.seed.filter { !existing.contains($0.id) }
            let stamp = store.now()
            for exercise in missing {
                let row = ExerciseRow(exercise: exercise)
                try row.insert(db)
                try store.appendOutbox(row, op: .insert, at: stamp, db)
            }
            return missing.count
        }
    }
}
