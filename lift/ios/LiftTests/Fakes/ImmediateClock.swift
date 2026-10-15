import Foundation
import Synchronization

/// A clock whose `sleep` returns at once and moves `now` forward, so a countdown runs to its end without real
/// time (TEST-3). Counts the sleeps.
nonisolated final class ImmediateClock: Clock {
    struct Instant: InstantProtocol {
        var offset: Duration

        func advanced(by duration: Duration) -> Instant { Instant(offset: offset + duration) }
        func duration(to other: Instant) -> Duration { other.offset - offset }
        static func < (lhs: Instant, rhs: Instant) -> Bool { lhs.offset < rhs.offset }
    }

    private let current = Mutex(Instant(offset: .zero))
    private let sleeps = Mutex(0)

    var now: Instant { current.withLock { $0 } }
    var minimumResolution: Duration { .zero }
    /// How many times `sleep` was called.
    var sleepCount: Int { sleeps.withLock { $0 } }

    func sleep(until deadline: Instant, tolerance _: Duration?) async throws {
        try Task.checkCancellation()
        sleeps.withLock { $0 += 1 }
        current.withLock { $0 = Swift.max($0, deadline) }
    }
}
