import Foundation

@testable import Lift

/// Records what the Workout ViewModel asks of the rest Live Activity, in order, and keeps the rest as it stands outside
/// the app. `lockScreenExtend` and `lockScreenSkip` change that rest the way the Live Activity's buttons do while Lift
/// is in the background, without recording a call.
final class RecordingRestActivityController: RestActivityController {
    nonisolated enum Call: Equatable, Sendable {
        case start(RestActivityAttributes, RestActivityAttributes.ContentState)
        case update(endsAt: Date, totalSeconds: Int)
        case end
    }

    private(set) var calls: [Call] = []
    /// Every workout the screen showed, in order (kept apart from the rest calls).
    private(set) var shownWorkouts: [UUID] = []
    private var rest: RestSnapshot?

    func showWorkout(_ sessionID: UUID) {
        shownWorkouts.append(sessionID)
    }

    func resume() {}

    func start(_ attributes: RestActivityAttributes, state: RestActivityAttributes.ContentState) {
        calls.append(.start(attributes, state))
        rest = RestSnapshot(endsAt: state.endsAt, totalSeconds: state.totalSeconds)
    }

    func update(endsAt: Date, totalSeconds: Int) {
        calls.append(.update(endsAt: endsAt, totalSeconds: totalSeconds))
        rest = RestSnapshot(endsAt: endsAt, totalSeconds: totalSeconds)
    }

    func end() {
        calls.append(.end)
        rest = nil
    }

    func currentRest() -> RestSnapshot? {
        rest
    }

    /// +30s on the Lock Screen at `now`.
    func lockScreenExtend(at now: Date) {
        rest = rest?.extended(by: RestSnapshot.extensionSeconds, at: now)
    }

    /// Skip on the Lock Screen.
    func lockScreenSkip() {
        rest = nil
    }
}
