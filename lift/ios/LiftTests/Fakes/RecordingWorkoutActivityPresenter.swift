import Foundation

@testable import Lift

/// Records what `WorkoutActivityCenter` puts on the Lock Screen, in order. `running` stands in for a Live Activity left
/// from an earlier launch.
final class RecordingWorkoutActivityPresenter: WorkoutActivityPresenting {
    enum Call: Equatable {
        case show(WorkoutActivityAttributes, WorkoutActivityAttributes.ContentState)
        case end
    }

    private(set) var calls: [Call] = []
    var leftRunning: (attributes: WorkoutActivityAttributes, state: WorkoutActivityAttributes.ContentState)?

    /// The state shown last, or nil when nothing was shown or it was ended since.
    var shown: WorkoutActivityAttributes.ContentState? {
        guard case .show(_, let state)? = calls.last else { return nil }
        return state
    }

    func running() -> (attributes: WorkoutActivityAttributes, state: WorkoutActivityAttributes.ContentState)? {
        leftRunning
    }

    func show(_ attributes: WorkoutActivityAttributes, state: WorkoutActivityAttributes.ContentState) async {
        calls.append(.show(attributes, state))
    }

    func end() async {
        calls.append(.end)
    }
}
