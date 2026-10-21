import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Synchronization

/// A `SessionRepository` whose `observeSession` yields the given values, then finishes, so `await vm.run()`
/// returns. Records each requested id. Day ranges yield nothing. The Workout screen's writes (notes, remove, restore
/// and reorder exercises, finish, start, discard and its undo) are recorded, then throw `writeError` when one is
/// given; the others are not used by the Workout screen and throw.
nonisolated final class FakeSessionDetailRepository: SessionRepository {
    enum Call: Equatable, Sendable {
        case saveNote(UUID, String?)
        case saveExerciseNote(UUID, String?)
        case removeExercise(UUID)
        case restoreExercise(UUID)
        case reorder(UUID, [UUID])
        case finish(UUID)
        case start(UUID)
        case reschedule(UUID, RescheduleAction)
        case undo(RescheduleUndo)
    }

    private let emissions: [SessionDetail?]
    private let writeError: AppError?
    private let requests = Mutex<[UUID]>([])
    private let recorded = Mutex<[Call]>([])

    init(emissions: [SessionDetail?], writeError: AppError? = nil) {
        self.emissions = emissions
        self.writeError = writeError
    }

    /// The Workout screen's writes, in order, including ones that threw.
    var calls: [Call] { recorded.withLock { $0 } }

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

    func saveNote(sessionID: UUID, note: String?) async throws -> SessionRecord {
        try record(.saveNote(sessionID, note))
        guard let session = emissions.compactMap(\.self).last(where: { $0.id == sessionID })?.session else {
            throw AppError(.notFound)
        }
        return session
    }

    func saveExerciseNote(id: UUID, note: String?) async throws -> SessionExerciseRecord {
        try record(.saveExerciseNote(id, note))
        let items = emissions.compactMap(\.self).flatMap(\.items)
        guard let exercise = items.last(where: { $0.id == id })?.exercise else { throw AppError(.notFound) }
        return exercise
    }

    func removeExercise(id: UUID) async throws { try record(.removeExercise(id)) }
    func restoreExercise(id: UUID) async throws { try record(.restoreExercise(id)) }
    func reorderExercises(in sessionID: UUID, ids: [UUID]) async throws { try record(.reorder(sessionID, ids)) }

    func finish(sessionID: UUID) async throws -> SessionRecord {
        try record(.finish(sessionID))
        guard var session = emissions.compactMap(\.self).last(where: { $0.id == sessionID })?.session else {
            throw AppError(.notFound)
        }
        session.finishedAt = ManualNow.start
        return session
    }

    func start(sessionID: UUID) async throws -> SessionRecord {
        try record(.start(sessionID))
        guard var session = emissions.compactMap(\.self).last(where: { $0.id == sessionID })?.session else {
            throw AppError(.notFound)
        }
        session.startedAt = session.startedAt ?? ManualNow.start
        return session
    }

    func reschedule(_ sessionID: UUID, _ action: RescheduleAction) async throws -> RescheduleUndo {
        try record(.reschedule(sessionID, action))
        return RescheduleUndo(sessionID: sessionID, previousDay: Fixtures.monday)
    }

    func undo(_ change: RescheduleUndo) async throws { try record(.undo(change)) }

    private func record(_ call: Call) throws {
        recorded.withLock { $0.append(call) }
        if let writeError { throw writeError }
    }

    func createImportedSession(_: Session) async throws -> SessionRecord {
        throw AppError(.unknown, detail: "not used")
    }
}
