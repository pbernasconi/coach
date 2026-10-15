import Foundation
import GRDB
import LiftCore

/// The query behind `ExerciseHistoryRepository`: live rows only, logged sets only.
enum ExerciseHistoryQuery {
    static func entries(_ db: Database, exerciseID: UUID, limit: Int) throws -> [ExerciseHistoryEntry] {
        guard limit > 0 else { return [] }
        let slots =
            try SessionExerciseRecord
            .filter(Column("exerciseID") == exerciseID)
            .filter(Column.deletedAt == nil)
            .order(Column.position, Column.id)
            .fetchAll(db)
        guard !slots.isEmpty else { return [] }
        let sets =
            try SetRecord
            .filter(slots.map(\.id).contains(Column("sessionExerciseID")))
            .filter(Column.deletedAt == nil)
            .filter(Column("status") == SetStatus.done.rawValue)
            .order(Column.position, Column.id)
            .fetchAll(db)
        let setsBySlot = Dictionary(grouping: sets, by: \.sessionExerciseID)
        let loggedSlots = slots.filter { setsBySlot[$0.id] != nil }
        let sessions =
            try SessionRecord
            .filter(Set(loggedSlots.map(\.sessionID)).contains(Column.id))
            .filter(Column.deletedAt == nil)
            .order(Column("day").desc, Column("createdAt").desc, Column.id)
            .limit(limit)
            .fetchAll(db)
        let slotsBySession = Dictionary(grouping: loggedSlots, by: \.sessionID)
        return sessions.compactMap { session in
            guard let slots = slotsBySession[session.id], let first = slots.first else { return nil }
            let logged = slots.flatMap { setsBySlot[$0.id] ?? [] }
            return ExerciseHistoryEntry(session: session, loadMode: first.loadMode, sets: logged)
        }
    }
}
