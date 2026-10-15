import Foundation

/// The link between a session and the Apple Health workout Lift saved for it (`session.healthWorkoutID`, v5). Apart
/// from `SessionRepository` because only the Health recorder uses it. Each write is one transaction with one outbox
/// entry (DATA-3).
public protocol SessionHealthRepository: Sendable {
    /// The session row, live or removed; nil when there is none. A discarded session still names the workout to delete.
    func healthSession(id: UUID) async throws -> SessionRecord?

    /// Stores the saved workout's id on the session, or clears it (nil) once the workout is deleted from Health. Works
    /// on a removed session too, so a discard can clear it.
    func setHealthWorkoutID(_ workoutID: UUID?, forSession sessionID: UUID) async throws
}
