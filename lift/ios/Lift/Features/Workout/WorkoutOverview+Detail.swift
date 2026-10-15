import Foundation
import LiftCore
import LiftStore

extension WorkoutOverview {
    /// The screen's view of a stored session, with hints worked out by the LiftCore rules.
    init(detail: SessionDetail, days: DayCalendar) {
        let sets = detail.items.flatMap(\.sets)
        self.init(
            title: detail.session.title,
            dayTitle: days.longTitle(of: detail.session.day),
            loggedSets: sets.count(where: { $0.status == .done }),
            totalSets: sets.count,
            exercises: detail.items.map { WorkoutExercise(item: $0, unit: detail.session.unitsAtLog) }
        )
    }
}

extension WorkoutExercise {
    init(item: SessionDetail.Item, unit: WeightUnit) {
        let exercise = item.exercise
        let working = item.sets.filter { $0.kind == .working }
        let heaviest = working.compactMap(\.target.weight).max { $0.value < $1.value }
        let plateSet = PlateSet.standard(heaviest?.unit ?? unit)
        let isBarbell = exercise.equipment == .barbell && exercise.loadMode == .total
        let barbellWeight = isBarbell ? heaviest : nil
        let shared = working.first.map(\.target).flatMap { first in
            working.allSatisfy { $0.target == first } ? first : nil
        }
        self.init(
            id: exercise.id,
            name: exercise.displayName,
            target: shared.flatMap { WorkoutText.exerciseTarget(sets: working.count, target: $0) },
            warmUp: barbellWeight.flatMap { weight in
                let steps = WarmUpPlanner.plan(working: weight, equipment: .barbell, plates: plateSet)
                return WorkoutText.warmUp(steps, unit: plateSet.unit)
            },
            plates: barbellWeight.map { weight in
                WorkoutText.plates(PlateMath.load(for: weight, using: plateSet), bar: plateSet.bar)
            },
            progression: Self.progression(item: item, working: working, unit: unit),
            sets: Self.rows(item.sets)
        )
    }

    /// Once every working set is logged or skipped, the next target from `Progression`; otherwise a weight the user
    /// wrote down for next time, if any.
    private static func progression(item: SessionDetail.Item, working: [SetRecord], unit: WeightUnit) -> String? {
        let hint = item.exercise.nextTimeHint.map(WorkoutText.nextTimeHint)
        guard !working.isEmpty, working.allSatisfy({ $0.status != .planned }), let first = working.first else {
            return hint
        }
        let range = first.target.repRange ?? first.target.reps.map { $0...$0 }
        guard let range else { return hint }
        let increment = (item.exercise.equipment ?? .other).defaultIncrement(in: first.unit)
        let suggestion = Progression.suggest(repRange: range, last: item.sets.map(\.loggedSet), increment: increment)
        return WorkoutText.progression(suggestion) ?? hint
    }

    /// Set rows, numbered within each kind ("Warm-up 1", "Set 1", "Set 2").
    private static func rows(_ sets: [SetRecord]) -> [WorkoutSetItem] {
        var counts: [SetKind: Int] = [:]
        return sets.map { set in
            let number = (counts[set.kind] ?? 0) + 1
            counts[set.kind] = number
            return WorkoutSetItem(
                id: set.id,
                title: WorkoutText.setTitle(number: number, kind: set.kind),
                target: WorkoutText.target(set.target),
                actual: WorkoutText.values(reps: set.actualReps, weight: set.actualWeight),
                status: set.status
            )
        }
    }
}

extension SetEditor {
    /// An editor over `set`, starting from its saved values or, when there are none, its target.
    init(set: SetRecord, title: String) {
        let weight = (set.actualWeight ?? set.target.weight)?.converted(to: set.unit).value ?? 0
        let reps = set.actualReps ?? set.target.reps ?? set.target.repRange?.lowerBound ?? 0
        self.init(
            id: set.id,
            title: title,
            unit: set.unit,
            step: set.unit == .kg ? 2.5 : 5,
            weight: weight,
            reps: reps,
            savedWeight: weight,
            savedReps: reps
        )
    }
}
