import Foundation
import Observation

/// A screen pushed onto a tab's navigation stack.
nonisolated enum AppRoute: Hashable, Sendable {
    case workout(UUID)
    /// How to do a library exercise, and its recent history.
    case exercise(UUID)
    /// Third-party work bundled with the app and its licences.
    case acknowledgements
}

/// Opens routes. ViewModels take this protocol, so tests can record what they opened (SCR-3).
protocol Navigating: AnyObject {
    func open(_ route: AppRoute)
}

/// The navigation path of one tab. Owned by the tab's view; handed to ViewModels as `any Navigating`.
@Observable
final class TabRouter: Navigating {
    var path: [AppRoute]

    init(path: [AppRoute] = []) {
        self.path = path
    }

    func open(_ route: AppRoute) {
        path.append(route)
    }
}
