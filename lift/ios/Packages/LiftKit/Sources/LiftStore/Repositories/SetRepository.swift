import Foundation
import LiftCore

/// Sets inside a session exercise. Each write is one transaction with one outbox entry (DATA-3).
///
/// Product rule: saving weight or reps (Done in the editor) stores values only and never logs the set.
/// Logging is its own one-tap write.
public protocol SetRepository: Sendable {
    /// Appends a planned set, stamped with the session's unit and the exercise's load mode (DATA-6).
    func addSet(to sessionExerciseID: UUID, kind: SetKind, target: SetTarget) async throws -> SetRecord

    /// Saves the values shown in the editor. Never changes `status` or `completedAt`.
    func saveValues(setID: UUID, reps: Int?, weight: Weight?) async throws -> SetRecord

    /// Logs the set as done now. Missing values are filled from the target.
    func log(setID: UUID) async throws -> SetRecord

    /// Marks the set skipped.
    func skip(setID: UUID) async throws -> SetRecord

    /// Undoes `log` or `skip`: back to planned, values kept.
    func unlog(setID: UUID) async throws -> SetRecord

    /// Soft-deletes a set.
    func remove(setID: UUID) async throws

    /// Undoes `remove`.
    func restore(setID: UUID) async throws
}
