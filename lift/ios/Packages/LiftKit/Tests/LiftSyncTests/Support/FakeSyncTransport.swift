import Foundation
import LiftStore
import LiftSync
import Synchronization

/// A scripted `SyncTransport` that records every call (TEST-2). Pushes accept everything unless a test
/// queues another outcome; pulls return queued pages, then an empty final page that echoes the cursor.
final class FakeSyncTransport: SyncTransport {
    enum Call: Hashable, Sendable {
        case push(PushRequest)
        case pull(cursor: String?, limit: Int)
    }

    enum PushOutcome: Sendable {
        case acceptAll
        case rejectAll(reason: String)
        /// Accepts only the first `count` changes and does not mention the rest.
        case acceptFirst(Int)
        case fail(SyncTransportError)
    }

    private struct State {
        var calls: [Call] = []
        var pushOutcomes: [PushOutcome] = []
        var pullResults: [Result<PullResponse, SyncTransportError>] = []
        var holdPushes = false
        var held: [CheckedContinuation<Void, Never>] = []
    }

    private let state = Mutex(State())

    var calls: [Call] { state.withLock { $0.calls } }
    var pushes: [PushRequest] {
        calls.compactMap { call in
            if case .push(let body) = call { return body }
            return nil
        }
    }
    var pullCursors: [String?] {
        calls.compactMap { call in
            if case .pull(let cursor, _) = call { return .some(cursor) }
            return nil
        }
    }
    var heldCount: Int { state.withLock { $0.held.count } }

    func queuePush(_ outcomes: PushOutcome...) { state.withLock { $0.pushOutcomes += outcomes } }
    func queuePull(_ response: PullResponse) { state.withLock { $0.pullResults.append(.success(response)) } }
    func queuePullFailure(_ error: SyncTransportError) { state.withLock { $0.pullResults.append(.failure(error)) } }

    /// Makes every push wait until `release()`.
    func holdPushes() { state.withLock { $0.holdPushes = true } }

    func release() {
        let held = state.withLock { state in
            state.holdPushes = false
            defer { state.held = [] }
            return state.held
        }
        for continuation in held { continuation.resume() }
    }

    func push(_ body: PushRequest) async throws -> PushResponse {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            let wait = state.withLock { state in
                state.calls.append(.push(body))
                if state.holdPushes { state.held.append(continuation) }
                return state.holdPushes
            }
            if !wait { continuation.resume() }
        }
        let outcome = state.withLock { state in state.pushOutcomes.isEmpty ? .acceptAll : state.pushOutcomes.removeFirst() }
        let keys = body.changes.map(\.idempotencyKey)
        switch outcome {
        case .acceptAll: return PushResponse(accepted: keys)
        case .acceptFirst(let count): return PushResponse(accepted: Array(keys.prefix(count)))
        case .fail(let error): throw error
        case .rejectAll(let reason):
            return PushResponse(accepted: [], rejected: keys.map { .init(idempotencyKey: $0, reason: reason) })
        }
    }

    func pull(cursor: String?, limit: Int) async throws -> PullResponse {
        let result = state.withLock { state in
            state.calls.append(.pull(cursor: cursor, limit: limit))
            return state.pullResults.isEmpty ? nil : state.pullResults.removeFirst()
        }
        guard let result else { return PullResponse(changes: [], cursor: cursor, hasMore: false) }
        return try result.get()
    }
}
