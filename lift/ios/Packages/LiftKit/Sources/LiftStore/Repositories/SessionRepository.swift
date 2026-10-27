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

/// What `SessionRepository.undoReset` needs: the session and the sets `resetToPlanned` changed, as they were before.
public struct SessionReset: Hashable, Sendable {
    public let session: SessionRecord
    public let sets: [SetRecord]

    public init(session: SessionRecord, sets: [SetRecord]) {
        self.session = session
        self.sets = sets
    }
}

/// A change to a running workout's time from the Workout screen.
public enum SessionTimeChange: Hashable, Sendable {
    /// Stops the clock now. Only a started, unfinished, unpaused session changes.
    case pause
    /// Starts the clock again; the pause's whole seconds are added to `pausedSeconds`. Only a paused session changes.
    case resume
    /// Moves the start (the person forgot Start, or started early). Never later than the finish, or now.
    case start(at: Date)
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

    /// Saves what was written for the whole session. The note is trimmed; an empty one clears it.
    func saveNote(sessionID: UUID, note: String?) async throws -> SessionRecord

    /// Saves what was written about one exercise of a session. The note is trimmed; an empty one clears it.
    func saveExerciseNote(id: UUID, note: String?) async throws -> SessionExerciseRecord

    /// Marks a live session finished now. Planned sets stay planned; nothing is logged. When the start was never
    /// stamped, it becomes the first logged set's time.
    func finish(sessionID: UUID) async throws -> SessionRecord

    /// Stamps `startedAt` now on a live session that has neither a start nor a finish. A session already started or
    /// finished is returned as it is, with no write, so a second Start (or a Start after the first logged set) is safe.
    func start(sessionID: UUID) async throws -> SessionRecord

    /// Pauses, resumes or moves the start of a live session. A change that does not apply (a pause of a paused
    /// session, a resume of a running one) returns the session as it is, with no write.
    func changeTime(sessionID: UUID, _ change: SessionTimeChange) async throws -> SessionRecord

    /// Renames a live session. The title is trimmed; an empty one keeps the old title, with no write.
    func rename(sessionID: UUID, title: String) async throws -> SessionRecord

    /// Moves, pushes or removes a live session. Returns what `undo` needs.
    func reschedule(_ sessionID: UUID, _ action: RescheduleAction) async throws -> RescheduleUndo

    /// Puts a rescheduled session back on its previous day and clears any tombstone.
    func undo(_ change: RescheduleUndo) async throws

    /// Puts a live session back as planned on `day`, in one write: no start, pause or finish, and each logged or skipped
    /// set planned again without its values. The session stays, so its plan workout keeps it (Discard of a workout
    /// that Start moved here from a later day).
    func resetToPlanned(sessionID: UUID, on day: LocalDay) async throws -> SessionReset

    /// Undoes `resetToPlanned`: the session's day and times and the sets' values as they were.
    func undoReset(_ reset: SessionReset) async throws
}
