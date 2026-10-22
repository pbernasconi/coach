import Foundation
import Observation

/// Switches the shell's tab from inside a screen, such as a coach tip that links to the Week tab. ViewModels take this
/// protocol, so tests can record the switch (SCR-3).
@MainActor
protocol TabSwitching: AnyObject {
    func show(_ tab: AppTab)
}

/// The shell's selected tab. `AppShell` binds the tab bar to it; `AppDependencies.tabs` hands it to screens. A tap
/// on the tab that is already selected asks that tab to go back to its root (`rootRequests`).
@Observable
final class TabSwitcher: TabSwitching {
    private(set) var selected: AppTab
    /// Counts the re-taps of each tab; its stack pops to the root when its count changes.
    private(set) var rootRequests: [AppTab: Int] = [:]
    /// The screen a link or a notice asked each tab to show (`open(_:)`). The tab's stack applies a request once, when
    /// it changes or when the stack first appears, so a link that comes before the tab exists still opens its screen.
    private(set) var routeRequests: [AppTab: TabRouteRequest] = [:]
    private var routeSerial = 0

    init(selected: AppTab = .week) {
        self.selected = selected
    }

    func show(_ tab: AppTab) {
        selected = tab
    }

    /// Selects the destination's tab and asks its stack to show exactly the destination's route over the root (the
    /// root alone when it has none), whatever was pushed before.
    func open(_ destination: ScreenDestination) {
        routeSerial += 1
        routeRequests[destination.tab] = TabRouteRequest(serial: routeSerial, route: destination.route)
        selected = destination.tab
    }

    /// The tab bar picked `tab`: a switch, or a re-tap of the selected tab, which asks for its root.
    func barPicked(_ tab: AppTab) {
        if tab == selected { rootRequests[tab, default: 0] += 1 }
        selected = tab
    }
}

/// A screen a link asked a tab to show. `serial` tells two requests for the same route apart.
nonisolated struct TabRouteRequest: Equatable, Sendable {
    var serial: Int
    var route: AppRoute?
}

extension TabSwitcher: ScreenLinkOpening {}
