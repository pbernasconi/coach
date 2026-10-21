import Foundation

/// How long a coach page fetched fresh stays shown without a new fetch when the person comes back to it (a pop, a
/// segment switch). Pull to refresh always fetches.
nonisolated enum LiftRefresh {
    static let interval: TimeInterval = 60

    /// True when `fetchedAt` is less than `interval` before `now`.
    static func isFresh(_ fetchedAt: Date?, now: Date) -> Bool {
        guard let fetchedAt else { return false }
        return now.timeIntervalSince(fetchedAt) < interval
    }
}
