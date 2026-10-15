import Foundation
import LiftStore

/// Whether Lift may save workouts to Apple Health. Only sharing matters: Lift reads nothing from Health (PLAT-3).
nonisolated enum HealthAuthorization: Equatable, Sendable {
    /// This device has no Health data (some iPads).
    case unavailable
    /// Lift has never asked.
    case notDetermined
    /// The person said no, now or in the Health settings.
    case denied
    case authorized
}

/// What Lift saves to Apple Health for a finished session: a traditional strength training workout from its start to
/// its finish, named with the session's title. No energy: Lift has no honest way to estimate it.
nonisolated struct HealthWorkout: Equatable, Sendable {
    let sessionID: UUID
    let title: String
    let start: Date
    let end: Date

    /// The workout for `session`; nil until it is finished with a known start before its finish (a session finished
    /// with nothing logged has no start, and an imported one has neither).
    init?(session: SessionRecord) {
        guard let start = session.startedAt, let end = session.finishedAt, start < end else { return nil }
        self.init(sessionID: session.id, title: session.title, start: start, end: end)
    }

    init(sessionID: UUID, title: String, start: Date, end: Date) {
        self.sessionID = sessionID
        self.title = title
        self.start = start
        self.end = end
    }
}

/// Apple Health, as far as Lift uses it: ask to share workouts, save one, delete one Lift saved (DI-5). The live
/// implementation is `LiveHealthWorkoutStore`; tests pass a fake.
protocol HealthWorkoutStore: AnyObject {
    func authorization() -> HealthAuthorization

    /// Shows the system's Health permission sheet for workouts, if it was never shown.
    func requestAuthorization() async throws

    /// Saves `workout` and returns the Health workout's id.
    func save(_ workout: HealthWorkout) async throws -> UUID

    /// Deletes the workout Lift saved with `workoutID`; nothing happens when it is gone already.
    func delete(workoutID: UUID) async throws
}
