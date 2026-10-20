import Foundation
import LiftCore
import LiftStore
import Synchronization

/// Passes every call to `base`, except that the `failingAddSet`-th `addSet` or `addImported` (1-based, counted
/// together) throws `error`, so a test can stop an import part-way through a workout.
nonisolated final class FailingSetRepository: SetRepository {
    private let base: any SetRepository
    private let failingAddSet: Int
    private let error: AppError
    private let addSetCalls = Mutex(0)

    init(base: any SetRepository, failingAddSet: Int, error: AppError) {
        self.base = base
        self.failingAddSet = failingAddSet
        self.error = error
    }

    func addSet(to sessionExerciseID: UUID, kind: SetKind, target: SetTarget) async throws -> SetRecord {
        try countAddSet()
        return try await base.addSet(to: sessionExerciseID, kind: kind, target: target)
    }

    func addImported(_ set: LoggedSet, to sessionExerciseID: UUID, completedAt: Date?) async throws -> SetRecord {
        try countAddSet()
        return try await base.addImported(set, to: sessionExerciseID, completedAt: completedAt)
    }

    private func countAddSet() throws {
        let call = addSetCalls.withLock { count in
            count += 1
            return count
        }
        if call == failingAddSet { throw error }
    }

    func saveValues(setID: UUID, reps: Int?, weight: Weight?) async throws -> SetRecord {
        try await base.saveValues(setID: setID, reps: reps, weight: weight)
    }

    func saveDetails(setID: UUID, rpe: Double?, note: String?) async throws -> SetRecord {
        try await base.saveDetails(setID: setID, rpe: rpe, note: note)
    }

    func log(setID: UUID) async throws -> SetRecord { try await base.log(setID: setID) }
    func skip(setID: UUID) async throws -> SetRecord { try await base.skip(setID: setID) }
    func unlog(setID: UUID) async throws -> SetRecord { try await base.unlog(setID: setID) }
    func remove(setID: UUID) async throws { try await base.remove(setID: setID) }
    func restore(setID: UUID) async throws { try await base.restore(setID: setID) }
}
