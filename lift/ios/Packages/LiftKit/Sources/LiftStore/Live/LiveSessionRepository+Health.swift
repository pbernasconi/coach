import Foundation
import GRDB

/// The Apple Health link of a session (v5).
extension LiveSessionRepository: SessionHealthRepository {
    public func healthSession(id: UUID) async throws -> SessionRecord? {
        try await store.writer.read { db in try SessionRecord.fetchOne(db, key: id) }
    }

    public func setHealthWorkoutID(_ workoutID: UUID?, forSession sessionID: UUID) async throws {
        _ = try await store.change(SessionRecord.self, id: sessionID, includeDeleted: true) { session, _ in
            session.healthWorkoutID = workoutID
        }
    }
}
