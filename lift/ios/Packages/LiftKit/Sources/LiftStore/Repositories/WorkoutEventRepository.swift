import Foundation

/// The workout timeline (v10): every moment of a workout with its time, for analysis later (actual rest, time per
/// exercise, pauses). Each record is one insert with one outbox entry (DATA-3), so it syncs to the server.
public protocol WorkoutEventRepository: Sendable {
    /// Stores `event` as a new row.
    func record(_ event: WorkoutEvent) async throws

    /// A session's moments in the order they happened (tests and analysis).
    func events(sessionID: UUID) async throws -> [WorkoutEventRecord]
}
