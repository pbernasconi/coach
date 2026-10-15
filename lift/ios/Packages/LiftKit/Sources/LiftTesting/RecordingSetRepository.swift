import Foundation
import LiftCore
import LiftStore
import Synchronization

/// A `SetRepository` fake that records every call, for ViewModel tests (TEST-2). Writes return `result`,
/// or throw `error` when it is set.
public final class RecordingSetRepository: SetRepository {
    public enum Call: Hashable, Sendable {
        case addSet(sessionExerciseID: UUID, kind: SetKind, target: SetTarget)
        case addImported(LoggedSet, sessionExerciseID: UUID, completedAt: Date?)
        case saveValues(setID: UUID, reps: Int?, weight: Weight?)
        case log(UUID)
        case skip(UUID)
        case unlog(UUID)
        case remove(UUID)
        case restore(UUID)
    }

    private let state: Mutex<[Call]> = Mutex([])
    private let result: SetRecord
    private let error: AppError?

    public init(result: SetRecord, error: AppError? = nil) {
        self.result = result
        self.error = error
    }

    /// Every call so far, in order.
    public var calls: [Call] { state.withLock { $0 } }

    public func addSet(to sessionExerciseID: UUID, kind: SetKind, target: SetTarget) async throws -> SetRecord {
        try record(.addSet(sessionExerciseID: sessionExerciseID, kind: kind, target: target))
    }

    public func addImported(_ set: LoggedSet, to sessionExerciseID: UUID, completedAt: Date?) async throws
        -> SetRecord
    {
        try record(.addImported(set, sessionExerciseID: sessionExerciseID, completedAt: completedAt))
    }

    public func saveValues(setID: UUID, reps: Int?, weight: Weight?) async throws -> SetRecord {
        try record(.saveValues(setID: setID, reps: reps, weight: weight))
    }

    public func log(setID: UUID) async throws -> SetRecord { try record(.log(setID)) }
    public func skip(setID: UUID) async throws -> SetRecord { try record(.skip(setID)) }
    public func unlog(setID: UUID) async throws -> SetRecord { try record(.unlog(setID)) }
    public func remove(setID: UUID) async throws { _ = try record(.remove(setID)) }
    public func restore(setID: UUID) async throws { _ = try record(.restore(setID)) }

    private func record(_ call: Call) throws -> SetRecord {
        state.withLock { $0.append(call) }
        if let error { throw error }
        return result
    }
}
