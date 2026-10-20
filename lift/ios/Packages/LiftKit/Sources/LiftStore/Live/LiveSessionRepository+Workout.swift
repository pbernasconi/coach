import Foundation
import GRDB

/// The Workout screen's Start.
extension LiveSessionRepository {
    public func start(sessionID: UUID) async throws -> SessionRecord {
        let store = store
        return try await store.transaction { db, stamp in
            let session = try SessionQueries.liveSession(db, id: sessionID)
            guard session.startedAt == nil, session.finishedAt == nil else { return session }
            var started = session
            started.startedAt = stamp
            return try store.updateRow(started, at: stamp, db)
        }
    }
}
