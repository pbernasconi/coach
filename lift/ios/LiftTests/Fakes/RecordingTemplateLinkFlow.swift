import Foundation
import LiftStore

@testable import Lift

/// A `TemplateLinkFlow` and `TemplateLinkPresenting` that record what the review and the router asked for.
final class RecordingTemplateLinkFlow: TemplateLinkFlow, TemplateLinkPresenting {
    nonisolated struct Finish: Equatable, Sendable {
        let addition: TemplateLinkAddition
        let count: Int
    }

    private(set) var finishes: [Finish] = []
    private(set) var cancels = 0
    private(set) var payloads: [String] = []

    func finish(_ addition: TemplateLinkAddition, count: Int) {
        finishes.append(Finish(addition: addition, count: count))
    }

    func cancel() {
        cancels += 1
    }

    func present(payload: String) {
        payloads.append(payload)
    }
}
