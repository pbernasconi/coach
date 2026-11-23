import Foundation
import GRDB
import LiftCore

/// The kg/lb switch in Settings, applied to the workouts that are still open.
extension LiveSessionRepository {
    public func switchOpenSessions(to unit: WeightUnit, from day: LocalDay, gym: GymSetup) async throws -> Int {
        let store = store
        return try await store.transaction { db, stamp in
            let open =
                try SessionRecord
                .filter(Column.deletedAt == nil)
                .filter(Column("finishedAt") == nil)
                .filter(Column("day") >= DayText.encode(day))
                .fetchAll(db)
                .filter { $0.unitsAtLog != unit }
            for session in open {
                guard let detail = try SessionQueries.detail(db, id: session.id) else { continue }
                for item in detail.items {
                    let step = gym.increment(for: item.exercise.equipment, in: unit)
                    for set in item.sets {
                        guard let switched = set.switched(to: unit, step: step) else { continue }
                        try store.updateRow(switched, at: stamp, db)
                    }
                }
                var changed = session
                changed.unitsAtLog = unit
                try store.updateRow(changed, at: stamp, db)
            }
            return open.count
        }
    }
}

extension SetRecord {
    /// This set in `unit`, its target and any value typed but not logged converted and rounded to `step` (a load the
    /// gym can make), or nil when it keeps its unit: it is already in `unit`, or it was logged or skipped, and a logged
    /// set keeps the unit it was logged in (DATA-6).
    func switched(to unit: WeightUnit, step: Weight) -> SetRecord? {
        guard status == .planned, self.unit != unit else { return nil }
        let convert = { (weight: Weight?) -> Weight? in
            weight.map { $0.converted(to: unit).rounded(to: step) }
        }
        var set = self
        set.target.weight = convert(target.weight)
        set.actualWeight = convert(actualWeight)
        set.unit = unit
        return set
    }
}
