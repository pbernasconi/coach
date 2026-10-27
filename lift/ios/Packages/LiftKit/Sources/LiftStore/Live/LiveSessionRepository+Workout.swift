import Foundation
import GRDB
import LiftCore

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

/// Discard of a workout Start moved from a later day: back to planned, and its Undo.
extension LiveSessionRepository {
    public func resetToPlanned(sessionID: UUID, on day: LocalDay) async throws -> SessionReset {
        let store = store
        return try await store.transaction { db, stamp in
            let session = try SessionQueries.liveSession(db, id: sessionID)
            let done = try SessionQueries.detail(db, id: sessionID)?.items.flatMap(\.sets) ?? []
            let changed = done.filter { $0.status != .planned }
            var planned = session
            planned.startedAt = nil
            planned.finishedAt = nil
            planned.pausedAt = nil
            planned.pausedSeconds = 0
            if planned.day != day {
                planned.day = day
                planned.dayMovedAt = stamp  // the server moves the plan workout back with it
            }
            if planned != session { try store.updateRow(planned, at: stamp, db) }
            for set in changed {
                var reset = set
                reset.status = .planned
                reset.completedAt = nil
                reset.actualReps = nil
                reset.actualWeight = nil
                reset.rpe = nil
                try store.updateRow(reset, at: stamp, db)
            }
            return SessionReset(session: session, sets: changed)
        }
    }

    public func undoReset(_ reset: SessionReset) async throws {
        let store = store
        try await store.transaction { db, stamp in
            let session = try SessionQueries.liveSession(db, id: reset.session.id)
            var back = session
            back.startedAt = reset.session.startedAt
            back.finishedAt = reset.session.finishedAt
            back.pausedAt = reset.session.pausedAt
            back.pausedSeconds = reset.session.pausedSeconds
            if back.day != reset.session.day {
                back.day = reset.session.day
                back.dayMovedAt = stamp
            }
            if back != session { try store.updateRow(back, at: stamp, db) }
            for before in reset.sets {
                // A set removed since the reset stays removed.
                guard let set = try SetRecord.fetchOne(db, key: before.id), set.deletedAt == nil else { continue }
                var logged = set
                logged.status = before.status
                logged.completedAt = before.completedAt
                logged.actualReps = before.actualReps
                logged.actualWeight = before.actualWeight
                logged.rpe = before.rpe
                if logged != set { try store.updateRow(logged, at: stamp, db) }
            }
        }
    }
}
