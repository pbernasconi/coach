import Foundation

/// The rest countdown shown after a set is logged, in whole seconds. Pure value logic: the ViewModel owns the
/// clock and calls `ticked()` once a second, so tests drive it without real time (TEST-3).
nonisolated struct RestTimer: Equatable, Sendable {
    /// The rest used when an exercise has no rest time of its own.
    static let defaultSeconds = 90
    /// What +30s adds.
    static let extensionSeconds = 30

    /// Which start this is. A new start gets a new number, so the screen restarts its ticking task.
    let run: Int
    /// The whole rest, including any time added.
    private(set) var total: Int
    /// Seconds left; never below zero.
    private(set) var remaining: Int

    init(run: Int, seconds: Int) {
        self.run = run
        total = max(0, seconds)
        remaining = max(0, seconds)
    }

    /// One second later, or nil once the rest is over.
    func ticked() -> RestTimer? {
        guard remaining > 1 else { return nil }
        var next = self
        next.remaining -= 1
        return next
    }

    /// The same rest with `seconds` more on it.
    func extended(by seconds: Int) -> RestTimer {
        var next = self
        next.total += max(0, seconds)
        next.remaining += max(0, seconds)
        return next
    }

    /// The same rest with at most `seconds` left, or nil when none are. Keeps the countdown in step with the wall
    /// clock after the app was in the background, where the ticks stop.
    func capped(at seconds: Int) -> RestTimer? {
        guard seconds > 0 else { return nil }
        var next = self
        next.remaining = min(remaining, seconds)
        return next
    }

    /// The time left as "1:30" or "0:05".
    var clockText: String {
        let seconds = remaining % 60
        return "\(remaining / 60):" + (seconds < 10 ? "0\(seconds)" : "\(seconds)")
    }

    /// Seconds already rested, for a bar that fills up.
    var elapsed: Int { total - remaining }
}
