import Foundation

/// The one test for "this window takes the wide (iPad) rules", so a screen never spells out its own device check.
/// It needs an iPad and a regular horizontal size class: an iPhone is never wide in either orientation, and a narrow
/// Split View half on an iPad takes the phone rules. A Mac window always takes the wide rules. `WideWindowReader` and `AdaptiveColumns` read it.
nonisolated public enum TabletLayout {
    /// The window takes the wide rules.
    public static func isWideWindow(isPad: Bool, isRegularWidth: Bool) -> Bool { isPad && isRegularWidth }
}
