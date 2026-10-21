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

    init(selected: AppTab = .today) {
        self.selected = selected
    }

    func show(_ tab: AppTab) {
        selected = tab
    }

    /// The tab bar picked `tab`: a switch, or a re-tap of the selected tab, which asks for its root.
    func barPicked(_ tab: AppTab) {
        if tab == selected { rootRequests[tab, default: 0] += 1 }
        selected = tab
    }
}
