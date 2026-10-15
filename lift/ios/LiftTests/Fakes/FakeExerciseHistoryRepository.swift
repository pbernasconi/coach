import Foundation
import LiftStore
import Synchronization

/// An `ExerciseHistoryRepository` whose stream yields the given values, then finishes, so `await vm.run()` returns.
/// Records each request.
nonisolated final class FakeExerciseHistoryRepository: ExerciseHistoryRepository {
    /// One `observeHistory` call.
    struct Request: Equatable, Sendable {
        let exerciseID: UUID
        let limit: Int
    }

    private let emissions: [[ExerciseHistoryEntry]]
    private let requests = Mutex<[Request]>([])

    init(emissions: [[ExerciseHistoryEntry]]) {
        self.emissions = emissions
    }

    /// Every request, in order.
    var requested: [Request] { requests.withLock { $0 } }

    func observeHistory(exerciseID: UUID, limit: Int) -> AsyncStream<[ExerciseHistoryEntry]> {
        requests.withLock { $0.append(Request(exerciseID: exerciseID, limit: limit)) }
        let emissions = emissions
        return AsyncStream { continuation in
            for value in emissions {
                continuation.yield(value)
            }
            continuation.finish()
        }
    }
}
