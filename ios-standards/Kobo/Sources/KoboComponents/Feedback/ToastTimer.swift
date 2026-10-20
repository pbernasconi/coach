import Foundation

/// The auto-dismiss timer of the toast on screen. A finger on the toast stops it (`hold`), so someone reading with a
/// finger on it keeps it; the release starts it again with the time that was left, and never with less than
/// `minimumAfterHold`, so the toast does not vanish the moment the finger lifts.
nonisolated struct ToastTimer: Equatable, Sendable {
    /// A release never leaves less than this, so the toast is seen leaving.
    static let minimumAfterHold: Duration = .seconds(1)

    /// The time left from the last start or release.
    private(set) var remaining: Duration
    /// True while a finger is on the toast.
    private(set) var isHeld = false

    init(lifetime: Duration) {
        remaining = lifetime
    }

    /// A finger landed on the toast after the timer had run for `ran` since its last start or release.
    mutating func hold(afterRunning ran: Duration) {
        guard !isHeld else { return }
        remaining = max(.zero, remaining - ran)
        isHeld = true
    }

    /// The finger left the toast.
    mutating func release() {
        guard isHeld else { return }
        remaining = max(remaining, Self.minimumAfterHold)
        isHeld = false
    }
}
