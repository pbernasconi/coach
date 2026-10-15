import Foundation
import LiftCore
import LiftStore

/// An `ExerciseRepository` whose stream yields the given values, then finishes, so `await vm.run()` returns.
/// Writes are not used by the Phase 1 screens and throw.
nonisolated final class FakeExerciseRepository: ExerciseRepository {
    private let emissions: [[Exercise]]

    init(emissions: [[Exercise]]) {
        self.emissions = emissions
    }

    func observeExercises() -> AsyncStream<[Exercise]> {
        let emissions = emissions
        return AsyncStream { continuation in
            for value in emissions {
                continuation.yield(value)
            }
            continuation.finish()
        }
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
