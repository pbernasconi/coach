import Foundation
import LiftStore

/// Where saving workouts to Apple Health stands, as Settings and the summary show it.
nonisolated enum HealthStatus: Equatable, Sendable {
    /// Demo or throwaway data: never saved to Health.
    case notSaved
    /// This device has no Health data.
    case unavailable
    /// The person turned it off in Lift.
    case off
    /// On in Lift, and Health has not been asked yet: the first finished workout asks.
    case notAsked
    /// On in Lift, but not allowed in Health.
    case denied
    case on
}

/// Saves finished workouts to Apple Health and removes the ones Lift saved (PLAT-3). ViewModels take this protocol;
/// `HealthRecorder` is the live one and `DisabledHealthRecorder` stands in for demo data.
protocol WorkoutHealthRecording: AnyObject {
    func status() -> HealthStatus

    /// After Finish: saves the session when saving is on and allowed. Never asks for permission.
    func sessionFinished(_ sessionID: UUID) async

    /// "Save to Apple Health" on the first summary: turns saving on, asks Health once, then saves the session.
    func allow(savingSession sessionID: UUID) async -> HealthStatus

    /// The Settings switch, or "Not now" (false). Turning it on asks Health when it never was.
    func setEnabled(_ isOn: Bool) async -> HealthStatus

    /// After a discard: deletes the session's workout from Health when Lift saved one.
    func sessionRemoved(_ sessionID: UUID) async

    /// After Undo of a discard: saves the session again when it is finished and saving is on.
    func sessionRestored(_ sessionID: UUID) async
}

/// The live `WorkoutHealthRecording`: Health through `HealthWorkoutStore`, the saved workout's id on the session
/// (`session.healthWorkoutID`), so a workout is saved once and only Lift's own is ever deleted. Failures are logged
/// and never block the workout.
final class HealthRecorder: WorkoutHealthRecording {
    private let store: any HealthWorkoutStore
    private let sessions: any SessionHealthRepository
    private let settings: any HealthSettingsStoring
    /// Sessions with a save on the way, so two triggers (Finish, then the summary) save once.
    private var saving: Set<UUID> = []

    init(store: any HealthWorkoutStore, sessions: any SessionHealthRepository, settings: any HealthSettingsStoring) {
        self.store = store
        self.sessions = sessions
        self.settings = settings
    }

    func status() -> HealthStatus {
        let authorization = store.authorization()
        if authorization == .unavailable { return .unavailable }
        guard settings.savesWorkouts else { return .off }
        return switch authorization {
        case .unavailable: .unavailable
        case .notDetermined: .notAsked
        case .denied: .denied
        case .authorized: .on
        }
    }

    func sessionFinished(_ sessionID: UUID) async {
        guard status() == .on else { return }
        await save(sessionID)
    }

    func allow(savingSession sessionID: UUID) async -> HealthStatus {
        let status = await setEnabled(true)
        if status == .on { await save(sessionID) }
        return status
    }

    func setEnabled(_ isOn: Bool) async -> HealthStatus {
        settings.savesWorkouts = isOn
        if isOn, status() == .notAsked {
            do {
                try await store.requestAuthorization()
            } catch {
                AppLog.health.error("Asking Health failed: \(String(describing: error), privacy: .private)")
            }
        }
        return status()
    }

    func sessionRemoved(_ sessionID: UUID) async {
        do {
            guard let workoutID = try await sessions.healthSession(id: sessionID)?.healthWorkoutID,
                store.authorization() == .authorized
            else { return }
            try await store.delete(workoutID: workoutID)
            try await sessions.setHealthWorkoutID(nil, forSession: sessionID)
        } catch {
            AppLog.health.error("Deleting from Health failed: \(String(describing: error), privacy: .private)")
        }
    }

    func sessionRestored(_ sessionID: UUID) async {
        await sessionFinished(sessionID)
    }

    /// Saves a live, finished session that has no Health workout yet, then stores the workout's id on it.
    private func save(_ sessionID: UUID) async {
        guard saving.insert(sessionID).inserted else { return }
        defer { saving.remove(sessionID) }
        do {
            guard let session = try await sessions.healthSession(id: sessionID), session.deletedAt == nil,
                session.healthWorkoutID == nil, let workout = HealthWorkout(session: session)
            else { return }
            let workoutID = try await store.save(workout)
            try await sessions.setHealthWorkoutID(workoutID, forSession: sessionID)
        } catch {
            AppLog.health.error("Saving to Health failed: \(String(describing: error), privacy: .private)")
        }
    }
}

/// The `WorkoutHealthRecording` for demo and throwaway data: never touches Health.
final class DisabledHealthRecorder: WorkoutHealthRecording {
    func status() -> HealthStatus { .notSaved }
    func sessionFinished(_: UUID) async {}
    func allow(savingSession _: UUID) async -> HealthStatus { .notSaved }
    func setEnabled(_: Bool) async -> HealthStatus { .notSaved }
    func sessionRemoved(_: UUID) async {}
    func sessionRestored(_: UUID) async {}
}
