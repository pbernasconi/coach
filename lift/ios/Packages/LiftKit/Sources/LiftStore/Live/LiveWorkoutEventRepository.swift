import Foundation
import GRDB

/// GRDB-backed `WorkoutEventRepository`.
public struct LiveWorkoutEventRepository: WorkoutEventRepository {
    private let store: StoreWriter

    public init(database: LiftDatabase, now: @escaping @Sendable () -> Date, makeID: @escaping @Sendable () -> UUID) {
        store = StoreWriter(writer: database.writer, now: now, makeID: makeID)
    }

    public func record(_ event: WorkoutEvent) async throws {
        let id = store.makeID()
        _ = try await store.insert { _, stamp in WorkoutEventRecord(id: id, event: event, createdAt: stamp) }
    }

    public func events(sessionID: UUID) async throws -> [WorkoutEventRecord] {
        try await store.writer.read { db in
            try WorkoutEventRecord
                .filter(Column("sessionID") == sessionID && Column.deletedAt == nil)
                .order(Column("occurredAt"), Column("createdAt"))
                .fetchAll(db)
        }
    }
}

/// Keeps no timeline: for callers that have nowhere to store one.
public struct NoWorkoutEvents: WorkoutEventRepository {
    public init() {}

    public func record(_: WorkoutEvent) async throws {}

    public func events(sessionID _: UUID) async throws -> [WorkoutEventRecord] { [] }
}
