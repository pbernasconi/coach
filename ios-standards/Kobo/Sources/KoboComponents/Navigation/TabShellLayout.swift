import Foundation

/// How a `TabShell` shows its tabs. Pick it once from the device idiom, which never changes while the app runs, so the
/// shell never swaps its `TabView` and every tab keeps its stack through a window resize.
nonisolated public enum TabShellLayout: Hashable, Sendable, CaseIterable {
    /// The bottom tab bar (iPhone).
    case tabBar
    /// iPad and Mac: a regular-width window shows the tabs at the top with a sidebar button; a compact window
    /// (Slide Over, a narrow Split View) shows the bottom tab bar.
    case sidebarAdaptable

    /// The layout for a device: an iPad adapts, an iPhone keeps its tab bar.
    public static func forDevice(isPad: Bool) -> TabShellLayout {
        isPad ? .sidebarAdaptable : .tabBar
    }
}

/// The pure rules of a `TabShell`.
nonisolated enum TabShellRules {
    /// A write from the bar is a switch (and plays the selection haptic) only when it names another tab.
    static func isSwitch<ID: Equatable>(from current: ID, to tab: ID) -> Bool { tab != current }
}
