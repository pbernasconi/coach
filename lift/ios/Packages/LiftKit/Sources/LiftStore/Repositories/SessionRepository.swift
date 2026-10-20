import Foundation
import LiftCore

/// How a session can be rescheduled from the lift sheet.
public enum RescheduleAction: Hashable, Sendable {
    case move(to: LocalDay)
    case pushToNextWeek
    case remove
}

/// What `SessionRepository.undo` needs to put a rescheduled session back.
public struct RescheduleUndo: Hashable, Sendable {
    public let sessionID: UUID
    public let previousDay: LocalDay

    public init(sessionID: UUID, previousDay: LocalDay) {
        self.sessionID = sessionID
        self.previousDay = previousDay
    }
}

/// Sessions and their exercises. Reads are streams (DATA-1); each write is one transaction with one outbox
/// entry (DATA-3). Removing is a soft delete, so every action can be undone without a confirmation dialog.
public protocol SessionRepository: Sendable {
    /// Live sessions from `first` through `last` (inclusive), by day then creation.
    func observeSessions(from first: LocalDay, through last: LocalDay) -> AsyncStream<[SessionDetail]>

    /// One live session, or nil once it is removed or if it never existed.
    func observeSession(id: UUID) -> AsyncStream<SessionDetail?>

    func createSession(on day: LocalDay, title: String, unit: WeightUnit, templateID: UUID?) async throws
        -> SessionRecord

    /// Creates a session as an import read it, in one write: its day, title, template, unit, note, warm-up note and,
    /// when known, its start and finish (its exercises are added after). One insert, so the notes can never lose a
    /// last-writer-wins tie to the bare row.
    func createImportedSession(_ session: Session) async throws -> SessionRecord

    /// Appends an exercise to a live session, stamping its load mode and equipment (DATA-6).
    func addExercise(_ slot: ExerciseSlot, to sessionID: UUID) async throws -> SessionExerciseRecord

    /// Soft-deletes a session exercise; its sets disappear with it.
    func removeExercise(id: UUID) async throws

    /// Undoes `removeExercise`.
    func restoreExercise(id: UUID) async throws

    /// Puts the session's live exercises in the order of `ids`, which must hold each of them once.
    func reorderExercises(in sessionID: UUID, ids: [UUID]) async throws

    /// Marks a live session finished now. Planned sets stay planned; nothing is logged. When the start was never
    /// stamped, it becomes the first logged set's time.
    func finish(sessionID: UUID) async throws -> SessionRecord

    /// Stamps `startedAt` now on a live session that has neither a start nor a finish. A session already started or
    /// finished is returned as it is, with no write, so a second Start (or a Start after the first logged set) is safe.
    func start(sessionID: UUID) async throws -> SessionRecord

    /// Moves, pushes or removes a live session. Returns what `undo` needs.
    func reschedule(_ sessionID: UUID, _ action: RescheduleAction) async throws -> RescheduleUndo

    /// Puts a rescheduled session back on its previous day and clears any tombstone.
    func undo(_ change: RescheduleUndo) async throws
}
