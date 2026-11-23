import Foundation
import GRDB
import LiftCore

/// Writes a session's warm-up (`WarmUpRecipe`) inside the caller's transaction: planned "W" sets before the working sets
/// of each exercise that has none yet and nothing logged, and the checklist in the session's warm-up note when the
/// note is empty. Earlier sets of an exercise move down to make room.
struct WarmUpWriter {
    let store: StoreWriter
    let db: Database
    let stamp: Date
    let gym: GymSetup

    /// Plans the warm-up of `sessionID`. Returns the session as saved, or nil when it is gone or already finished.
    @discardableResult
    func plan(sessionID: UUID) throws -> SessionRecord? {
        guard let detail = try SessionQueries.detail(db, id: sessionID), detail.session.finishedAt == nil else {
            return nil
        }
        let recipe = WarmUpRecipe.plan(detail.items.map(Self.recipeExercise), gym: gym)
        for (item, targets) in zip(detail.items, recipe.sets) where !targets.isEmpty {
            guard !item.sets.contains(where: { $0.kind == .warmUp || $0.status != .planned }) else { continue }
            for set in item.sets {
                var moved = set
                moved.position += targets.count
                try store.updateRow(moved, at: stamp, db)
            }
            for (index, target) in targets.enumerated() {
                let set = SetRecord(
                    id: store.makeID(),
                    sessionExerciseID: item.exercise.id,
                    position: (item.sets.map(\.position).min() ?? 0) + index,
                    kind: .warmUp,
                    target: target,
                    unit: detail.session.unitsAtLog,
                    loadMode: item.exercise.loadMode,
                    createdAt: stamp
                )
                try store.insertRow(set, at: stamp, db)
            }
        }
        guard NoteText.normalized(detail.session.warmUpNote) == nil else { return detail.session }
        var session = detail.session
        session.warmUpNote = recipe.checklist.note
        return try store.updateRow(session, at: stamp, db)
    }

    /// The recipe's view of one exercise: its equipment, load mode and first working set's weight.
    private static func recipeExercise(_ item: SessionDetail.Item) -> WarmUpRecipe.Exercise {
        WarmUpRecipe.Exercise(
            equipment: item.exercise.equipment,
            loadMode: item.exercise.loadMode,
            working: item.sets.first { $0.kind == .working }?.target.weight
        )
    }
}
