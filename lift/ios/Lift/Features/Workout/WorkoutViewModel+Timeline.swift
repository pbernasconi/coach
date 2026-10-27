import Foundation
import LiftStore

/// The workout timeline (`WorkoutEventRepository`): each moment of the workout is stored with its time, so actual
/// rests, time per exercise and pauses can be worked out later (Paolo, 2026-10-27). A moment is recorded as it happens
/// on this screen; the Lock Screen's buttons record their own (`WorkoutActivityCenter`). A failed write is only
/// logged: the timeline never gets in the way of the workout.
extension WorkoutViewModel {
    /// The moments a tap stands for by itself. Sets logged and undone, rests started, extended and run out, and the
    /// automatic start and resume are recorded where they happen.
    func recordMoment(for action: WorkoutAction) {
        guard case .loaded(let workout) = state.workout else { return }
        switch action {
        case .startTapped where workout.startedAt == nil: record(.workoutStarted)
        case .pauseTapped where workout.startedAt != nil: record(.workoutPaused)
        case .resumeTapped: record(.workoutResumed)
        case .finishConfirmed: record(.workoutFinished)
        case .finishTapped where state.plannedSetsLeft == 0: record(.workoutFinished)
        case .discardTapped: record(.workoutDiscarded)
        case .exerciseStartTapped(let setID): record(.exerciseStarted, setID: setID)
        case .setSkipTapped(let id): record(.setSkipped, setID: id)
        case .setRemoveTapped(let id): record(.setRemoved, setID: id)
        case .restSkipTapped:
            // Skip, or Finish ending a rest: how long it ran.
            if let rest = state.rest { record(.restSkipped, setID: rest.setID, seconds: rest.elapsed) }
        default: break
        }
    }

    /// Waits until every moment recorded so far is stored (tests).
    func timelineSettled() async {
        await recording?.value
    }

    /// Stores one moment of this workout, at `at` (now by default).
    func record(_ kind: WorkoutEventKind, setID: UUID? = nil, seconds: Int? = nil, at: Date? = nil) {
        let event = WorkoutEvent(
            sessionID: sessionID,
            kind: kind,
            occurredAt: at ?? now(),
            setID: setID,
            seconds: seconds,
            source: .app
        )
        let events = events
        let previous = recording
        recording = Task {
            await previous?.value
            do {
                try await events.record(event)
            } catch {
                AppLog.workout.error(
                    "Recording \(kind.rawValue) failed: \(String(describing: error), privacy: .private)"
                )
            }
        }
    }
}
