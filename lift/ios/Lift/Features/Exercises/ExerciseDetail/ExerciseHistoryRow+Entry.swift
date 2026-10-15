import Foundation
import LiftCore
import LiftStore

extension ExerciseHistoryRow {
    /// One past session: its day, the best logged set and that set's estimated one-rep max (`OneRepMax`).
    /// The best set is the one with the highest estimate; sets without one fall back to weight, then reps.
    /// Warm-ups count only when nothing else was logged.
    init(entry: ExerciseHistoryEntry, days: DayCalendar) {
        let working = entry.sets.filter { $0.kind != .warmUp }
        let candidates = working.isEmpty ? entry.sets : working
        let scored = candidates.map { set in
            Scored(set: set, estimate: OneRepMax.estimate(set: set.loggedSet, loadMode: entry.loadMode))
        }
        let best = scored.max(by: Scored.isWeaker)
        self.init(
            id: entry.id,
            dayTitle: days.longTitle(of: entry.session.day),
            best: best.map { Self.setText($0.set) } ?? String(localized: "Logged"),
            sets: String(localized: "\(entry.sets.count) sets"),
            estimate: best?.estimate.map { String(localized: "Est. 1RM \(WorkoutText.weight($0.rounded(toStep: 0.5)))") }
        )
    }

    /// "5 @ 100 kg", or "8 reps" for a set without load.
    private static func setText(_ set: SetRecord) -> String {
        switch (set.actualReps, set.actualWeight) {
        case (let reps?, nil): String(localized: "\(reps) reps")
        default: WorkoutText.values(reps: set.actualReps, weight: set.actualWeight) ?? String(localized: "Logged")
        }
    }

    /// A set with its estimate, ranked across units.
    private struct Scored {
        let set: SetRecord
        let estimate: Weight?

        static func isWeaker(_ lhs: Scored, _ rhs: Scored) -> Bool {
            let left = (kilograms(lhs.estimate), kilograms(lhs.set.actualWeight), lhs.set.actualReps ?? 0)
            let right = (kilograms(rhs.estimate), kilograms(rhs.set.actualWeight), rhs.set.actualReps ?? 0)
            return left < right
        }

        private static func kilograms(_ weight: Weight?) -> Double {
            weight?.converted(to: .kg).value ?? -1
        }
    }
}
