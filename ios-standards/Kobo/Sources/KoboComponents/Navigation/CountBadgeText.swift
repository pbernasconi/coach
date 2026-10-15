import Foundation

/// The text of a `CountBadge` and of a `TabShell` tab badge. Pure, so tests check it without rendering.
nonisolated public enum CountBadgeText {
    /// Counts above this read as "99+".
    public static let defaultCap = 99

    /// The badge text for `count`: `nil` (no badge) at zero or below, the number up to `cap`, then "`cap`+".
    ///
    ///     CountBadgeText.label(for: 3)    // "3"
    ///     CountBadgeText.label(for: 120)  // "99+"
    public static func label(for count: Int, cap: Int = defaultCap) -> String? {
        guard count > 0 else { return nil }
        let cap = max(cap, 1)
        return count > cap ? "\(cap.formatted())+" : count.formatted()
    }

    /// The badge is shown at all.
    public static func isShown(_ count: Int) -> Bool { count > 0 }
}
