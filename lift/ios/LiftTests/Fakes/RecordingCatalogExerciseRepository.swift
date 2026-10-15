import Foundation
import LiftCore
import LiftStore
import Synchronization

/// An `ExerciseRepository` for the catalog screens: `observeExercises` yields `emissions` then finishes, and
/// `create(fromCatalog:)` records the entry and returns a library exercise for it (or throws `error`).
nonisolated final class RecordingCatalogExerciseRepository: ExerciseRepository {
    private let emissions: [[Exercise]]
    private let error: AppError?
    private let created = Mutex<[String]>([])

    init(emissions: [[Exercise]], error: AppError? = nil) {
        self.emissions = emissions
        self.error = error
    }

    /// The catalog ids passed to `create(fromCatalog:)`, in order.
    var createdCatalogIDs: [String] { created.withLock { $0 } }

    /// The id `create(fromCatalog:)` gives the new exercise.
    static let createdID = UUID(uuid: (0xCA, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 1))

    func observeExercises() -> AsyncStream<[Exercise]> {
        let emissions = emissions
        return AsyncStream { continuation in
            for value in emissions {
                continuation.yield(value)
            }
            continuation.finish()
        }
    }

    func create(fromCatalog entry: CatalogExercise) async throws -> Exercise {
        created.withLock { $0.append(entry.id) }
        if let error { throw error }
        return Exercise(
            id: Self.createdID,
            name: entry.name,
            equipment: entry.libraryEquipment,
            loadMode: entry.libraryLoadMode,
            primary: entry.primaryMuscles,
            catalogID: entry.id,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    func create(
        name _: String,
        equipment _: Equipment,
        loadMode _: LoadMode,
        primary _: [Muscle],
        secondary _: [Muscle]
    ) async throws -> Exercise {
        throw AppError(.unknown, detail: "not used")
    }

    func update(_: Exercise) async throws -> Exercise {
        throw AppError(.unknown, detail: "not used")
    }

    func remove(id _: UUID) async throws {
        throw AppError(.unknown, detail: "not used")
    }

    func restore(id _: UUID) async throws {
        throw AppError(.unknown, detail: "not used")
    }

    func installLibrary() async throws -> Int {
        throw AppError(.unknown, detail: "not used")
    }
}
