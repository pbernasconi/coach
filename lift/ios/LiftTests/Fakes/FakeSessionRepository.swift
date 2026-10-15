import Foundation
import LiftCore
import LiftStore
import Synchronization

/// A `SessionRepository` whose stream yields the given values, then finishes, so `await vm.run()` returns.
/// Records each requested day range. Writes are not used by the Phase 1 screens and throw.
nonisolated final class FakeSessionRepository: SessionRepository {
    private let emissions: [[SessionDetail]]
    private let requests = Mutex<[ClosedRange<LocalDay>]>([])

    init(emissions: [[SessionDetail]]) {
        self.emissions = emissions
    }

    /// Every range passed to `observeSessions`, in order.
    var requestedRanges: [ClosedRange<LocalDay>] { requests.withLock { $0 } }

    func observeSessions(from first: LocalDay, through last: LocalDay) -> AsyncStream<[SessionDetail]> {
        requests.withLock { $0.append(first...last) }
        let emissions = emissions
        return AsyncStream { continuation in
            for value in emissions {
                continuation.yield(value)
            }
            continuation.finish()
        }
    }

    func observeSession(id _: UUID) -> AsyncStream<SessionDetail?> {
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

    func reschedule(_: UUID, _: RescheduleAction) async throws -> RescheduleUndo {
        throw AppError(.unknown, detail: "not used")
    }

    func undo(_: RescheduleUndo) async throws {
        throw AppError(.unknown, detail: "not used")
    }
}
