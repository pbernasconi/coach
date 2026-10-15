import Foundation
import LiftCore
import LiftStore
import Synchronization

/// A `SessionRepository` whose `observeSession` yields the given values, then finishes, so `await vm.run()`
/// returns. Records each requested id. Day ranges yield nothing; writes are not used by the Workout screen and throw.
nonisolated final class FakeSessionDetailRepository: SessionRepository {
    private let emissions: [SessionDetail?]
    private let requests = Mutex<[UUID]>([])

    init(emissions: [SessionDetail?]) {
        self.emissions = emissions
    }

    /// Every id passed to `observeSession`, in order.
    var requestedIDs: [UUID] { requests.withLock { $0 } }

    func observeSession(id: UUID) -> AsyncStream<SessionDetail?> {
        requests.withLock { $0.append(id) }
        let emissions = emissions
        return AsyncStream { continuation in
            for value in emissions {
                continuation.yield(value)
            }
            continuation.finish()
        }
    }

    func observeSessions(from _: LocalDay, through _: LocalDay) -> AsyncStream<[SessionDetail]> {
        AsyncStream { $0.finish() }
    }

    func createSession(on _: LocalDay, title _: String, unit _: WeightUnit, templateID _: UUID?) async throws
        -> SessionRecord
    {
        throw AppError(.unknown, detail: "not used")
    }

    func addExercise(_: ExerciseSlot, to _: UUID) async throws -> SessionExerciseRecord {
        throw AppError(.unknown, detail: "not used")
    }

    func removeExercise(id _: UUID) async throws {
        throw AppError(.unknown, detail: "not used")
    }

    func restoreExercise(id _: UUID) async throws {
        throw AppError(.unknown, detail: "not used")
    }

    func reorderExercises(in _: UUID, ids _: [UUID]) async throws {
        throw AppError(.unknown, detail: "not used")
    }

    func finish(sessionID _: UUID) async throws -> SessionRecord {
        throw AppError(.unknown, detail: "not used")
    }

    func reschedule(_: UUID, _: RescheduleAction) async throws -> RescheduleUndo {
        throw AppError(.unknown, detail: "not used")
    }

    func undo(_: RescheduleUndo) async throws {
        throw AppError(.unknown, detail: "not used")
    }

    func createImportedSession(_: Session) async throws -> SessionRecord {
        throw AppError(.unknown, detail: "not used")
    }
}
