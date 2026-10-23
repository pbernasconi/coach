import Foundation
import GRDB
import LiftCore

/// GRDB-backed `WorkoutPlanRepository`. Planned barbell loads go up in steps the person's plates can make (`gym`, read
/// at each write, so a change in Settings applies to the next plan).
public struct LiveWorkoutPlanRepository: WorkoutPlanRepository {
    private let store: StoreWriter
    private let gym: @Sendable () -> GymSetup

    public init(
        database: LiftDatabase,
        now: @escaping @Sendable () -> Date,
        makeID: @escaping @Sendable () -> UUID,
        gym: @escaping @Sendable () -> GymSetup = { .standard }
    ) {
        store = StoreWriter(writer: database.writer, now: now, makeID: makeID)
        self.gym = gym
    }

    public func createSession(from templateID: UUID, on day: LocalDay, unit: WeightUnit) async throws
        -> SessionRecord
    {
        let store = store
        let gym = gym()
        return try await store.transaction { db, stamp in
            let template = try TemplateQueries.liveTemplate(db, id: templateID)
            let builder = SessionBuilder(store: store, db: db, stamp: stamp, gym: gym)
            return try builder.session(from: template, on: day, unit: unit)
        }
    }

    public func createSession(
        titled title: String,
        on day: LocalDay,
        unit: WeightUnit,
        exercises: [CoachExercise]
    ) async throws -> SessionRecord {
        let store = store
        let gym = gym()
        return try await store.transaction { db, stamp in
            let session = SessionRecord(
                id: store.makeID(),
                day: day,
                title: title,
                templateID: nil,
                unitsAtLog: unit,
                createdAt: stamp,
                updatedAt: stamp
            )
            try store.insertRow(session, at: stamp, db)
            let slots = exercises.map { item in
                TemplateExercise(
                    id: store.makeID(),
                    exerciseID: item.exercise.id,
                    displayName: item.exercise.name,
                    sets: item.sets,
                    repRange: item.repRange,
                    note: item.note
                )
            }
            try SessionBuilder(store: store, db: db, stamp: stamp, gym: gym).append(slots, to: session)
            return session
        }
    }

    public func addExercise(_ exercise: Exercise, to sessionID: UUID) async throws -> SessionExerciseRecord {
        let store = store
        let gym = gym()
        return try await store.transaction { db, stamp in
            let session = try SessionQueries.liveSession(db, id: sessionID)
            let builder = SessionBuilder(store: store, db: db, stamp: stamp, gym: gym)
            let last = try builder.history(of: exercise.id, excluding: sessionID).last
            let slot = SlotPlanner.slot(id: store.makeID(), exercise: exercise, last: last)
            guard let added = try builder.append([slot], to: session).first else {
                throw AppError(.unknown, detail: "addExercise")
            }
            return added
        }
    }

    public func changeTemplate(of sessionID: UUID, to templateID: UUID) async throws -> TemplateChangeUndo {
        let store = store
        let gym = gym()
        return try await store.transaction { db, stamp in
            guard let detail = try SessionQueries.detail(db, id: sessionID) else {
                throw AppError(.notFound, detail: "session \(sessionID)")
            }
            guard !detail.items.contains(where: { $0.sets.contains { $0.status != .planned } }) else {
                throw AppError(.conflict, detail: "session \(sessionID) has logged sets")
            }
            let template = try TemplateQueries.liveTemplate(db, id: templateID)
            for item in detail.items {
                try store.setDeleted(item.exercise, true, at: stamp, db)
            }
            var session = detail.session
            session.title = template.name
            session.templateID = template.id
            session = try store.updateRow(session, at: stamp, db)
            let slots = try TemplateQueries.liveSlots(db, templateID: templateID).map(\.slot)
            let added = try SessionBuilder(store: store, db: db, stamp: stamp, gym: gym).append(slots, to: session)
            return TemplateChangeUndo(
                sessionID: sessionID,
                previousTitle: detail.session.title,
                previousTemplateID: detail.session.templateID,
                removedExerciseIDs: detail.items.map(\.id),
                addedExerciseIDs: added.map(\.id)
            )
        }
    }

    public func undo(_ change: TemplateChangeUndo) async throws {
        let store = store
        try await store.transaction { db, stamp in
            guard var session = try SessionRecord.fetchOne(db, key: change.sessionID) else {
                throw AppError(.notFound, detail: "session \(change.sessionID)")
            }
            for id in change.addedExerciseIDs {
                guard let row = try SessionExerciseRecord.fetchOne(db, key: id) else { continue }
                try store.setDeleted(row, true, at: stamp, db)
            }
            for id in change.removedExerciseIDs {
                guard let row = try SessionExerciseRecord.fetchOne(db, key: id) else { continue }
                try store.setDeleted(row, false, at: stamp, db)
            }
            session.title = change.previousTitle
            session.templateID = change.previousTemplateID
            try store.updateRow(session, at: stamp, db)
        }
    }

    public func planNextWeek(from weekStart: LocalDay) async throws -> WeekPlanUndo {
        let store = store
        let gym = gym()
        return try await store.transaction { db, stamp in
            let source = try Self.sessions(db, from: weekStart, through: weekStart.adding(days: 6))
            var taken = Set(
                try Self.sessions(db, from: weekStart.adding(days: 7), through: weekStart.adding(days: 13)).map(\.day)
            )
            var created: [UUID] = []
            for session in source {
                let day = session.day.adding(days: 7)
                guard let templateID = session.templateID, !taken.contains(day),
                    let template = try TemplateRecord.fetchOne(db, key: templateID), template.deletedAt == nil
                else { continue }
                let planned = try SessionBuilder(store: store, db: db, stamp: stamp, gym: gym)
                    .session(from: template, on: day, unit: session.unitsAtLog)
                created.append(planned.id)
                taken.insert(day)
            }
            return WeekPlanUndo(sessionIDs: created)
        }
    }

    public func undo(_ plan: WeekPlanUndo) async throws {
        let store = store
        try await store.transaction { db, stamp in
            for id in plan.sessionIDs {
                guard let session = try SessionRecord.fetchOne(db, key: id) else { continue }
                try store.setDeleted(session, true, at: stamp, db)
            }
        }
    }

    // MARK: - Helpers

    /// Live sessions from `first` through `last`, by day then creation.
    private static func sessions(_ db: Database, from first: LocalDay, through last: LocalDay) throws
        -> [SessionRecord]
    {
        try SessionRecord
            .filter(Column.deletedAt == nil)
            .filter(Column("day") >= DayText.encode(first) && Column("day") <= DayText.encode(last))
            .order(Column("day"), Column("createdAt"), Column.id)
            .fetchAll(db)
    }
}
