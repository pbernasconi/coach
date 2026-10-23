import Foundation

@testable import Lift

/// A `Navigating` that records every route it is asked to open, in order, and how often it went back.
@MainActor
final class RecordingNavigator: Navigating {
    private(set) var opened: [AppRoute] = []
    private(set) var backCount = 0
    private(set) var backToRootCount = 0

    func open(_ route: AppRoute) {
        opened.append(route)
    }

    func back() {
        backCount += 1
    }

    func backToRoot() {
        backToRootCount += 1
    }
}
