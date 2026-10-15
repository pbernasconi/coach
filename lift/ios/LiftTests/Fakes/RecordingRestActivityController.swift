import Foundation

@testable import Lift

/// Records what the Workout ViewModel asks of the rest Live Activity, in order.
final class RecordingRestActivityController: RestActivityController {
    nonisolated enum Call: Equatable, Sendable {
        case start(RestActivityAttributes, RestActivityAttributes.ContentState)
        case update(endsAt: Date, totalSeconds: Int)
        case end
    }

    private(set) var calls: [Call] = []

    func start(_ attributes: RestActivityAttributes, state: RestActivityAttributes.ContentState) {
        calls.append(.start(attributes, state))
    }

    func update(endsAt: Date, totalSeconds: Int) {
        calls.append(.update(endsAt: endsAt, totalSeconds: totalSeconds))
    }

    func end() {
        calls.append(.end)
    }
}
