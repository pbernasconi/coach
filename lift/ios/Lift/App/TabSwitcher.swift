import Foundation
import Observation

/// Switches the shell's tab from inside a screen, such as a coach tip that links to the Week tab. ViewModels take this
/// protocol, so tests can record the switch (SCR-3).
@MainActor
protocol TabSwitching: AnyObject {
    func show(_ tab: AppTab)
    /// Leaves `tab` for the tab shown before it, or `fallback` when there was none.
    func leave(_ tab: AppTab, fallback: AppTab)
}

/// The shell's selected tab. `AppShell` binds the tab bar to it; `AppDependencies.tabs` hands it to screens. A tap
/// on the tab that is already selected asks that tab to go back to its root (`rootRequests`).
@Observable
final class TabSwitcher: TabSwitching {
    private(set) var selected: AppTab {
        didSet { if oldValue != selected { previous = oldValue } }
    }
    /// The tab shown before the selected one, for a screen's close button.
    private(set) var previous: AppTab?
    /// Counts the re-taps of each tab; its stack pops to the root when its count changes.
    private(set) var rootRequests: [AppTab: Int] = [:]
    /// The screen a link or a notice asked each tab to show (`open(_:)`). The tab's stack applies a request once, when
    /// it changes or when the stack first appears, so a link that comes before the tab exists still opens its screen.
    private(set) var routeRequests: [AppTab: TabRouteRequest] = [:]
    private var routeSerial = 0
    /// Each tab's pushed screens as its stack last reported them (`stackChanged`), so the workout bar can go back to the
    /// tab that has the workout open. Nothing draws from it.
    @ObservationIgnored private var stacks: [AppTab: [AppRoute]] = [:]

    init(selected: AppTab = .week) {
        self.selected = selected
    }

    func show(_ tab: AppTab) {
        selected = tab
    }

    func leave(_ tab: AppTab, fallback: AppTab) {
        selected = previous.flatMap { $0 == tab ? nil : $0 } ?? fallback
    }

    /// Selects the destination's tab and asks its stack to show exactly the destination's route over the root (the
    /// root alone when it has none), whatever was pushed before.
    func open(_ destination: ScreenDestination) {
        request(destination.route.map { [$0] } ?? [], on: destination.tab)
    }

    /// A tab's stack now shows `path` over its root.
    func stackChanged(_ tab: AppTab, path: [AppRoute]) {
        stacks[tab] = path
    }

    /// Back to the workout under way (the bar above the tab bar). A tab that still has it open goes back down to it,
    /// closing what was pushed over it, so one Workout screen stays open; otherwise it opens over the selected tab's
    /// root.
    func openWorkout(_ sessionID: UUID) {
        let order = [selected] + AppTab.allCases.filter { $0 != selected }
        for tab in order {
            guard let path = stacks[tab], let index = path.firstIndex(where: { $0.opensWorkout(sessionID) }) else {
                continue
            }
            request(Array(path[...index]), on: tab)
            return
        }
        request([.workout(sessionID)], on: selected)
    }

    private func request(_ path: [AppRoute], on tab: AppTab) {
        routeSerial += 1
        routeRequests[tab] = TabRouteRequest(serial: routeSerial, path: path)
        selected = tab
    }

    /// The tab bar picked `tab`: a switch, or a re-tap of the selected tab, which asks for its root.
    func barPicked(_ tab: AppTab) {
        if tab == selected { rootRequests[tab, default: 0] += 1 }
        selected = tab
    }
}

/// The screens a link asked a tab to show over its root. `serial` tells two requests for the same route apart.
nonisolated struct TabRouteRequest: Equatable, Sendable {
    var serial: Int
    var path: [AppRoute]

    /// The screen on top; nil for the root alone.
    var route: AppRoute? { path.last }
}

extension AppRoute {
    /// This screen is the Workout screen of `sessionID`: the workout itself, or the coach's page of a session this
    /// iPhone has, which shows the local workout while it is not finished.
    nonisolated func opensWorkout(_ sessionID: UUID) -> Bool {
        switch self {
        case .workout(let id): id == sessionID
        case .liftSession(let id): id == sessionID.uuidString.lowercased()
        default: false
        }
    }
}

extension TabSwitcher: ScreenLinkOpening {}
