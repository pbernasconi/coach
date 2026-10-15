import Foundation
import GRDB
import LiftCore

/// Read queries shared by the session and set repositories. Each returns live rows only.
enum SessionQueries {
    static func details(_ db: Database, from first: LocalDay, through last: LocalDay) throws -> [SessionDetail] {
        let sessions =
            try SessionRecord
            .filter(Column.deletedAt == nil)
            .filter(Column("day") >= DayText.encode(first) && Column("day") <= DayText.encode(last))
            .order(Column("day"), Column("createdAt"), Column.id)
            .fetchAll(db)
        return try attach(db, to: sessions)
    }

    static func detail(_ db: Database, id: UUID) throws -> SessionDetail? {
        let sessions = try SessionRecord.filter(key: id).filter(Column.deletedAt == nil).fetchAll(db)
        return try attach(db, to: sessions).first
    }

    /// Loads the live exercises and sets of `sessions` in two queries and groups them.
    private static func attach(_ db: Database, to sessions: [SessionRecord]) throws -> [SessionDetail] {
        guard !sessions.isEmpty else { return [] }
        let exercises =
            try SessionExerciseRecord
            .filter(sessions.map(\.id).contains(Column("sessionID")))
            .filter(Column.deletedAt == nil)
            .order(Column.position, Column.id)
            .fetchAll(db)
        let sets =
            try SetRecord
            .filter(exercises.map(\.id).contains(Column("sessionExerciseID")))
            .filter(Column.deletedAt == nil)
            .order(Column.position, Column.id)
            .fetchAll(db)
        let setsByExercise = Dictionary(grouping: sets, by: \.sessionExerciseID)
        let itemsBySession = Dictionary(grouping: exercises, by: \.sessionID)
        let catalogIDs = try catalogIDs(db, libraryIDs: exercises.compactMap(\.exerciseID))
        return sessions.map { session in
            let items = (itemsBySession[session.id] ?? []).map { exercise in
                SessionDetail.Item(
                    exercise: exercise,
                    sets: setsByExercise[exercise.id] ?? [],
                    catalogID: exercise.exerciseID.flatMap { catalogIDs[$0] }
                )
            }
            return SessionDetail(session: session, items: items)
        }
    }

    /// Library exercise id → catalog id, for the given exercises that have one (removed ones included: a session keeps
    /// showing what it logged).
    private static func catalogIDs(_ db: Database, libraryIDs: [UUID]) throws -> [UUID: String] {
        guard !libraryIDs.isEmpty else { return [:] }
        let rows = try ExerciseRow.filter(Set(libraryIDs).contains(Column.id)).fetchAll(db)
        return Dictionary(rows.compactMap { row in row.exercise.catalogID.map { (row.id, $0) } }) { first, _ in first }
    }

    /// The next free position under a parent, counting removed rows so positions never repeat.
    static func nextPosition(_ db: Database, table: String, parentColumn: String, parentID: UUID) throws -> Int {
        let sql = "SELECT COALESCE(MAX(position), -1) + 1 FROM \(table) WHERE \(parentColumn) = ?"
        return try Int.fetchOne(db, sql: sql, arguments: [parentID]) ?? 0
    }

    /// A live session, or `AppError(.notFound)`.
    static func liveSession(_ db: Database, id: UUID) throws -> SessionRecord {
        guard let session = try SessionRecord.fetchOne(db, key: id), session.deletedAt == nil else {
            throw AppError(.notFound, detail: "session \(id)")
        }
        return session
    }

    /// A live session exercise in a live session, or `AppError(.notFound)`.
    static func liveExercise(_ db: Database, id: UUID) throws -> (SessionExerciseRecord, SessionRecord) {
        guard let exercise = try SessionExerciseRecord.fetchOne(db, key: id), exercise.deletedAt == nil else {
            throw AppError(.notFound, detail: "sessionExercise \(id)")
        }
        return (exercise, try liveSession(db, id: exercise.sessionID))
    }
}
