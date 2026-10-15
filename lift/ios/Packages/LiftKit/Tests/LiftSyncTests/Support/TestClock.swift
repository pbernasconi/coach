import Foundation
import Synchronization

/// A manual clock for tests: time moves only when a test calls `advance(by:)` (TEST-3).
final class TestClock: Clock {
    struct Instant: InstantProtocol {
        var offset: Swift.Duration

        func advanced(by duration: Swift.Duration) -> Instant { Instant(offset: offset + duration) }
        func duration(to other: Instant) -> Swift.Duration { other.offset - offset }
        static func < (lhs: Instant, rhs: Instant) -> Bool { lhs.offset < rhs.offset }
    }

    private struct Sleeper {
        let id: Int
        let deadline: Instant
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var now = Instant(offset: .zero)
        var nextID = 0
        var sleepers: [Sleeper] = []
    }

    private let state = Mutex(State())

    var now: Instant { state.withLock { $0.now } }
    var minimumResolution: Swift.Duration { .zero }
    var sleeperCount: Int { state.withLock { $0.sleepers.count } }

    func sleep(until deadline: Instant, tolerance _: Swift.Duration?) async throws {
        let id = state.withLock { state in
            state.nextID += 1
            return state.nextID
        }
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                let outcome: Result<Void, any Error>? = state.withLock { state in
                    if Task.isCancelled { return .failure(CancellationError()) }
                    if deadline <= state.now { return .success(()) }
                    state.sleepers.append(Sleeper(id: id, deadline: deadline, continuation: continuation))
                    return nil
                }
                if let outcome { continuation.resume(with: outcome) }
            }
        } onCancel: {
            let cancelled: CheckedContinuation<Void, any Error>? = state.withLock { state in
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
}

/// Yields until `condition` holds; bounded, so a bug fails the expectation instead of hanging.
func eventually(_ condition: () async -> Bool) async {
    var tries = 0
    while await !condition(), tries < 100_000 {
        tries += 1
        await Task.yield()
    }
}
