import Foundation

@testable import Lift

/// A `Navigating` that records every route it is asked to open, in order.
@MainActor
final class RecordingNavigator: Navigating {
    private(set) var opened: [AppRoute] = []

    func open(_ route: AppRoute) {
        opened.append(route)
    }
}
