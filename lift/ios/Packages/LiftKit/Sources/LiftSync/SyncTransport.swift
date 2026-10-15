import Foundation

/// The two sync endpoints (SYNC.md, DATA-8). `URLSessionSyncTransport` is the live one; tests use a fake.
public protocol SyncTransport: Sendable {
    /// `POST /api/lift/sync/push` with at most 500 changes.
    func push(_ body: PushRequest) async throws -> PushResponse

    /// `GET /api/lift/sync/pull?cursor=&limit=`. A nil cursor asks for a full pull.
    func pull(cursor: String?, limit: Int) async throws -> PullResponse
}

/// Why a sync request failed. Transports throw only this (or `CancellationError`).
public enum SyncTransportError: Error, Hashable, Sendable {
    /// No token is stored yet: nothing was sent.
    case missingToken
    /// `401`: the token is wrong or missing on the server.
    case unauthorized
    /// A network error or a `5xx`: the request may succeed later; outbox entries are kept.
    case retryable(status: Int?)
    /// Any other `4xx`: retrying the same request cannot succeed.
    case rejected(status: Int)
    /// A `2xx` whose body is not the contract's shape.
    case invalidResponse

    /// Maps an HTTP status to an error; nil for `2xx`.
    public static func forStatus(_ status: Int) -> SyncTransportError? {
        switch status {
        case 200..<300: nil
        case 401: .unauthorized
        case 500..<600: .retryable(status: status)
        case 400..<500: .rejected(status: status)
        default: .invalidResponse
        }
    }
}
