import Foundation
import LiftCore

/// The exercise library. Reads are streams from the local database (DATA-1); each write is one transaction
/// with one outbox entry (DATA-3).
public protocol ExerciseRepository: Sendable {
    /// Live (not deleted) exercises, archived ones included, sorted by name.
    func observeExercises() -> AsyncStream<[Exercise]>

    /// Adds a user exercise with a new id.
    func create(
        name: String,
        equipment: Equipment,
        loadMode: LoadMode,
        primary: [Muscle],
        secondary: [Muscle]
    ) async throws -> Exercise

    /// Saves the editable fields of `exercise` (name, aliases, equipment, load mode, muscles, video, archived).
    func update(_ exercise: Exercise) async throws -> Exercise

    /// Soft-deletes an exercise. Past sessions keep their stamped name and load mode.
    func remove(id: UUID) async throws

    /// Undoes `remove`.
    func restore(id: UUID) async throws

    /// Inserts the `ExerciseLibrary.seed` rows that are missing (a removed seed row stays removed).
    /// Returns how many were inserted.
    func installLibrary() async throws -> Int
}
