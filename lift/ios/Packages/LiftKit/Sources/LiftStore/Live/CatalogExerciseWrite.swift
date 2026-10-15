import Foundation
import GRDB
import LiftCore

/// `ExerciseRepository.create(fromCatalog:)`: one transaction that returns, revives or inserts the library row for a
/// catalog entry, with one outbox entry when it changes anything (DATA-3).
enum CatalogExerciseWrite {
    static func add(_ entry: CatalogExercise, store: StoreWriter) async throws -> Exercise {
        try await store.writer.write { db in
            let stamp = store.now()
            guard let existing = try existingRow(catalogID: entry.id, db) else {
                let row = ExerciseRow(exercise: exercise(from: entry, id: store.makeID(), stamp: stamp))
                try row.insert(db)
                try store.appendOutbox(row, op: .insert, at: stamp, db)
                return row.exercise
            }
            guard existing.deletedAt != nil || existing.exercise.isArchived else { return existing.exercise }
            var revived = existing
            revived.deletedAt = nil
            revived.exercise.isArchived = false
            revived.updatedAt = stamp
            try revived.update(db)
            try store.appendOutbox(revived, op: .update, at: stamp, db)
            return revived.exercise
        }
    }

    /// The row linked to `catalogID`: a live one first, else the most recently removed one.
    private static func existingRow(catalogID: String, _ db: Database) throws -> ExerciseRow? {
        try ExerciseRow
            .filter(Column("catalogID") == catalogID)
            .order(Column.deletedAt != nil, Column.deletedAt.desc, Column("createdAt"), Column.id)
            .fetchOne(db)
    }

    static func exercise(from entry: CatalogExercise, id: UUID, stamp: Date) -> Exercise {
        Exercise(
            id: id,
            name: entry.name,
            equipment: entry.libraryEquipment,
            loadMode: entry.libraryLoadMode,
            primary: entry.primaryMuscles,
            secondary: entry.secondaryMuscles,
            catalogID: entry.id,
            createdAt: stamp,
            updatedAt: stamp
        )
    }
}
