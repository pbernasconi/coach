import Foundation
import LiftStore

/// An outbox that only reports pending counts: `observePendingCount()` replays `counts`, then finishes.
nonisolated struct FakeOutboxCounts: OutboxRepository {
    let counts: [Int]

    func pending(limit _: Int) async throws -> [OutboxEntry] { [] }

    func observePendingCount() -> AsyncStream<Int> {
        let (stream, continuation) = AsyncStream.makeStream(of: Int.self)
        for count in counts { continuation.yield(count) }
        continuation.finish()
        return stream
    }

    func acknowledge(_: [UUID]) async throws {}
}
