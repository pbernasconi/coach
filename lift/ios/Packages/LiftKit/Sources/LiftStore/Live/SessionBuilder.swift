import Foundation
import GRDB
import LiftCore

/// Writes planned exercises and sets into a session inside the caller's transaction: one session exercise per slot,
/// stamped with the library exercise's name, load mode and equipment (DATA-6), and `slot.sets` planned sets whose
/// target `SlotPlanner` works out from the exercise's last two logged sessions, in load steps `gym` can make.
struct SessionBuilder {
    let store: StoreWriter
    let db: Database
    let stamp: Date
    let gym: GymSetup

    /// Inserts a session named after `template` on `day` with the template's exercises and planned sets.
    func session(from template: TemplateRecord, on day: LocalDay, unit: WeightUnit) throws -> SessionRecord {
        let session = SessionRecord(
            id: store.makeID(),
            day: day,
            title: template.name,
            templateID: template.id,
            unitsAtLog: unit,
            createdAt: stamp,
            updatedAt: stamp
        )
        try store.insertRow(session, at: stamp, db)
        try append(TemplateQueries.liveSlots(db, templateID: template.id).map(\.slot), to: session)
        return session
    }

    /// Appends `slots` to `session` after its existing exercises. Returns the new session exercises.
    @discardableResult
    func append(_ slots: [TemplateExercise], to session: SessionRecord) throws -> [SessionExerciseRecord] {
        let library = try TemplateQueries.library(db, ids: slots.map(\.exerciseID))
        var position = try SessionQueries.nextPosition(
            db,
            table: SessionExerciseRecord.databaseTableName,
            parentColumn: "sessionID",
            parentID: session.id
        )
        return try slots.map { slot in
            defer { position += 1 }
            return try insert(slot, exercise: library[slot.exerciseID], into: session, position: position)
        }
    }

    /// The done sets of the latest two sessions that logged `exerciseID`, newest first, leaving out `sessionID`.
    func history(of exerciseID: UUID, excluding sessionID: UUID? = nil) throws -> (
        last: [LoggedSet], previous: [LoggedSet]
    ) {
        let entries = try ExerciseHistoryQuery.entries(db, exerciseID: exerciseID, limit: 3)
            .filter { $0.session.id != sessionID }
        let sets = entries.prefix(2).map { $0.sets.map(\.loggedSet) }
        return (sets.first ?? [], sets.dropFirst().first ?? [])
    }

    /// What a planned session exercise starts with: the library name, load mode and equipment, the slot's rest and
    /// note.
    private static func sessionSlot(_ slot: TemplateExercise, exercise: Exercise?) -> ExerciseSlot {
        ExerciseSlot(
            exerciseID: slot.exerciseID,
            displayName: exercise?.name ?? slot.displayName,
            loadMode: exercise?.loadMode ?? .total,
            equipment: exercise?.equipment,
            restSeconds: slot.restSeconds,
            note: slot.note
        )
    }

    private func insert(
        _ slot: TemplateExercise,
        exercise: Exercise?,
        into session: SessionRecord,
        position: Int
    ) throws -> SessionExerciseRecord {
        let loadMode = exercise?.loadMode ?? .total
        let equipment = exercise?.equipment
        let record = SessionExerciseRecord(
            id: store.makeID(),
            sessionID: session.id,
            slot: Self.sessionSlot(slot, exercise: exercise),
            position: position,
            createdAt: stamp,
            updatedAt: stamp
        )
        try store.insertRow(record, at: stamp, db)
        let unit = session.unitsAtLog
        let (last, previous) = try history(of: slot.exerciseID, excluding: session.id)
        let target = SlotPlanner.target(
            for: slot,
            last: last,
            previous: previous,
            increment: gym.increment(for: equipment, in: unit),
            unit: unit
        )
        for index in 0..<max(1, slot.sets) {
            let set = SetRecord(
                id: store.makeID(),
                sessionExerciseID: record.id,
                position: index,
                kind: slot.kind,
                target: target,
                unit: unit,
                loadMode: loadMode,
                createdAt: stamp
            )
            try store.insertRow(set, at: stamp, db)
        }
        return record
    }
}
