import Foundation

/// The sync engine's view of the outbox (DATA-3).
public protocol OutboxRepository: Sendable {
    /// The oldest entries first, at most `limit` of them.
    func pending(limit: Int) async throws -> [OutboxEntry]

    /// How many entries wait to be pushed, for a sync badge.
    func observePendingCount() -> AsyncStream<Int>

    /// Removes entries the server acknowledged. Unknown ids are ignored, so a repeated ack is harmless.
    func acknowledge(_ ids: [UUID]) async throws
}
