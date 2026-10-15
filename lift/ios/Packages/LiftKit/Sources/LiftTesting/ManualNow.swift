import Foundation
import Synchronization

/// A wall clock that only moves when a test moves it (CONC-5, TEST-3).
public final class ManualNow: Sendable {
    /// 2026-03-02T09:00:00Z, a made-up Monday morning.
    public static let start = Date(timeIntervalSince1970: 1_772_442_000)

    private let current: Mutex<Date>

    public init(_ start: Date = ManualNow.start) {
        current = Mutex(start)
    }

    public func callAsFunction() -> Date {
        current.withLock { $0 }
    }

    public func advance(seconds: TimeInterval) {
        current.withLock { $0 = $0.addingTimeInterval(seconds) }
    }
}
