import Foundation
import Synchronization

/// Holds the current `SyncStatus` and fans it out (CONC-8): one continuation per subscriber, newest value
/// only, removed when the subscriber goes away. Each new subscriber gets the current value first.
final class SyncStatusBroadcaster: Sendable {
    private struct State {
        var current: SyncStatus
        var nextID = 0
        var subscribers: [Int: AsyncStream<SyncStatus>.Continuation] = [:]
    }

    private let state: Mutex<State>

    init(_ initial: SyncStatus) {
        state = Mutex(State(current: initial))
    }

    var current: SyncStatus { state.withLock { $0.current } }

    func stream() -> AsyncStream<SyncStatus> {
        let (stream, continuation) = AsyncStream.makeStream(of: SyncStatus.self, bufferingPolicy: .bufferingNewest(1))
        let id = state.withLock { state in
            let id = state.nextID
            state.nextID += 1
            state.subscribers[id] = continuation
            continuation.yield(state.current)
            return id
        }
        continuation.onTermination = { [weak self] _ in
            _ = self?.state.withLock { $0.subscribers.removeValue(forKey: id) }
        }
        return stream
    }

    /// Publishes `status` unless it equals the current one.
    func publish(_ status: SyncStatus) {
        state.withLock { state in
            guard state.current != status else { return }
            state.current = status
            for continuation in state.subscribers.values { continuation.yield(status) }
        }
    }

    /// Changes the current status with `change` and publishes the result.
    func update(_ change: (inout SyncStatus) -> Void) {
        var status = current
        change(&status)
        publish(status)
    }
}
