import Foundation
import LiftCore
import LiftStore

/// Passes every call to `base`, and runs `peek` on the main actor just before a `log` reaches it, so a test can see
/// what the app shows at the moment the set is written.
nonisolated final class PeekingSetRepository: SetRepository {
    private let base: any SetRepository
    private let peek: @MainActor @Sendable () -> Void

    init(base: any SetRepository, peek: @escaping @MainActor @Sendable () -> Void) {
        self.base = base
        self.peek = peek
    }

    func log(setID: UUID) async throws -> SetRecord {
        await peek()
        return try await base.log(setID: setID)
    }

    func addSet(to sessionExerciseID: UUID, kind: SetKind, target: SetTarget) async throws -> SetRecord {
        try await base.addSet(to: sessionExerciseID, kind: kind, target: target)
    }

    func addImported(_ set: LoggedSet, to sessionExerciseID: UUID, completedAt: Date?) async throws -> SetRecord {
        try await base.addImported(set, to: sessionExerciseID, completedAt: completedAt)
    }

    func saveValues(setID: UUID, reps: Int?, weight: Weight?) async throws -> SetRecord {
        try await base.saveValues(setID: setID, reps: reps, weight: weight)
    }

    func saveDetails(setID: UUID, rpe: Double?, note: String?) async throws -> SetRecord {
        try await base.saveDetails(setID: setID, rpe: rpe, note: note)
    }

    func skip(setID: UUID) async throws -> SetRecord { try await base.skip(setID: setID) }
    func unlog(setID: UUID) async throws -> SetRecord { try await base.unlog(setID: setID) }
    func remove(setID: UUID) async throws { try await base.remove(setID: setID) }
    func restore(setID: UUID) async throws { try await base.restore(setID: setID) }
}
