import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Synchronization

/// A `SessionRepository` whose stream yields the given values, then finishes, so `await vm.run()` returns.
/// Records each requested day range, reschedule and undo. `reschedule` answers with the session's day from the
/// emissions (or `Fixtures.monday`), and throws `rescheduleError` when one is given; `undo` throws `undoError`.
/// The other writes are not used by the screens yet and throw.
nonisolated final class FakeSessionRepository: SessionRepository {
    private let emissions: [[SessionDetail]]
    private let rescheduleError: AppError?
    private let undoError: AppError?
    private let requests = Mutex<[ClosedRange<LocalDay>]>([])
    private let reschedules = Mutex<[Reschedule]>([])
    private let undos = Mutex<[RescheduleUndo]>([])

    /// One `reschedule(_:_:)` call.
    struct Reschedule: Equatable, Sendable {
        let sessionID: UUID
        let action: RescheduleAction
    }

    init(emissions: [[SessionDetail]], rescheduleError: AppError? = nil, undoError: AppError? = nil) {
        self.emissions = emissions
        self.rescheduleError = rescheduleError
        self.undoError = undoError
    }

    /// Every range passed to `observeSessions`, in order.
    var requestedRanges: [ClosedRange<LocalDay>] { requests.withLock { $0 } }

    /// Every reschedule asked for, in order, including ones that threw.
    var rescheduled: [Reschedule] { reschedules.withLock { $0 } }

    /// Every undo asked for, in order, including ones that threw.
    var undone: [RescheduleUndo] { undos.withLock { $0 } }

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

    func reschedule(_ sessionID: UUID, _ action: RescheduleAction) async throws -> RescheduleUndo {
        reschedules.withLock { $0.append(Reschedule(sessionID: sessionID, action: action)) }
        if let rescheduleError { throw rescheduleError }
        let day = emissions.flatMap(\.self).last { $0.id == sessionID }?.session.day
        return RescheduleUndo(sessionID: sessionID, previousDay: day ?? Fixtures.monday)
    }

    func undo(_ change: RescheduleUndo) async throws {
        undos.withLock { $0.append(change) }
        if let undoError { throw undoError }
    }
}
