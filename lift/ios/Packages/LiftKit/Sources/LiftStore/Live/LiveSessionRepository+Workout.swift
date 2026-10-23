import Foundation
import GRDB

/// The Workout screen's Start, Pause and Resume, the start moved, and the name.
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

    public func changeTime(sessionID: UUID, _ change: SessionTimeChange) async throws -> SessionRecord {
        let store = store
        return try await store.transaction { db, stamp in
            let session = try SessionQueries.liveSession(db, id: sessionID)
            let changed = session.applying(change, at: stamp)
            guard changed != session else { return session }
            return try store.updateRow(changed, at: stamp, db)
        }
    }

    public func rename(sessionID: UUID, title: String) async throws -> SessionRecord {
        let store = store
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return try await store.transaction { db, stamp in
            let session = try SessionQueries.liveSession(db, id: sessionID)
            guard !trimmed.isEmpty, trimmed != session.title else { return session }
            var renamed = session
            renamed.title = trimmed
            return try store.updateRow(renamed, at: stamp, db)
        }
    }
}

extension SessionRecord {
    /// The session after `change` at `now`; the same session when the change does not apply.
    func applying(_ change: SessionTimeChange, at now: Date) -> SessionRecord {
        var next = self
        switch change {
        case .pause:
            guard startedAt != nil, finishedAt == nil, pausedAt == nil else { return self }
            next.pausedAt = now
        case .resume:
            return resumed(at: now)
        case .start(let date):
            next.startedAt = min(date, finishedAt ?? now)
        }
        return next
    }

    /// The session with a running pause ended at `now`: its whole seconds join `pausedSeconds`. Unchanged when it is
    /// not paused.
    func resumed(at now: Date) -> SessionRecord {
        guard let pausedAt else { return self }
        var next = self
        next.pausedSeconds += max(0, Int(now.timeIntervalSince(pausedAt).rounded(.down)))
        next.pausedAt = nil
        return next
    }
}
