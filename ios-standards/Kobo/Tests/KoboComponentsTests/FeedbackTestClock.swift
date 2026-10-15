import Foundation
import Synchronization

/// A manual clock for tests: time moves only when a test calls `advance(by:)`, so nothing waits on real time.
nonisolated final class TestClock: Clock {
    nonisolated struct Instant: InstantProtocol {
        var offset: Swift.Duration

        func advanced(by duration: Swift.Duration) -> Instant { Instant(offset: offset + duration) }
        func duration(to other: Instant) -> Swift.Duration { other.offset - offset }
        static func < (lhs: Instant, rhs: Instant) -> Bool { lhs.offset < rhs.offset }
    }

    private nonisolated struct Sleeper {
        let id: UUID
        let deadline: Instant
        let continuation: CheckedContinuation<Void, any Error>
    }

    private nonisolated struct State {
        var now = Instant(offset: .zero)
        var sleepers: [Sleeper] = []
    }

    private let state = Mutex(State())

    var now: Instant { state.withLock { $0.now } }
    var minimumResolution: Swift.Duration { .zero }

    /// How many tasks are currently suspended in `sleep`.
    var sleeperCount: Int { state.withLock { $0.sleepers.count } }

    func sleep(until deadline: Instant, tolerance _: Swift.Duration?) async throws {
        let id = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                let outcome: Result<Void, any Error>? = self.state.withLock { state in
                    // Checked under the lock, so a cancel that ran before this append is never missed.
                    if Task.isCancelled { return .failure(CancellationError()) }
                    if deadline <= state.now { return .success(()) }
                    state.sleepers.append(Sleeper(id: id, deadline: deadline, continuation: continuation))
                    return nil
                }
                if let outcome { continuation.resume(with: outcome) }
            }
        } onCancel: {
            let cancelled: CheckedContinuation<Void, any Error>? = self.state.withLock { state in
                guard let index = state.sleepers.firstIndex(where: { $0.id == id }) else { return nil }
                return state.sleepers.remove(at: index).continuation
            }
            cancelled?.resume(throwing: CancellationError())
        }
    }

    /// Moves time forward and wakes every sleeper whose deadline has passed.
    func advance(by duration: Swift.Duration) {
        let due: [CheckedContinuation<Void, any Error>] = state.withLock { state in
            state.now = state.now.advanced(by: duration)
            let now = state.now
            let due = state.sleepers.filter { $0.deadline <= now }
            state.sleepers.removeAll { $0.deadline <= now }
            return due.map(\.continuation)
        }
        for continuation in due { continuation.resume() }
    }

    /// Yields until `count` tasks are sleeping on this clock (bounded, so a bug fails instead of hanging).
    func waitForSleepers(_ count: Int) async {
        var tries = 0
        while sleeperCount < count, tries < 10_000 {
            tries += 1
            await Task.yield()
        }
    }
}

/// Yields until `condition` holds (bounded, so a bug fails the expectation instead of hanging).
@MainActor
func eventually(_ condition: () -> Bool) async {
    var tries = 0
    while !condition(), tries < 10_000 {
        tries += 1
        await Task.yield()
    }
}

/// Gives already-scheduled work a chance to run, to show that nothing happens.
@MainActor
func settle() async {
    for _ in 0..<100 { await Task.yield() }
}
