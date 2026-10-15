import Foundation

/// Plans the sets of one exercise in a new session: the slot's target, upgraded by `Progression` from the
/// exercise's last logged session, so the load goes up once it was earned.
///
/// - No history: the slot's own target.
/// - Every working set hit the top of the range: one increment over the last load, from the bottom of the range.
/// - Otherwise: the last load again, one more rep (clamped to the range).
/// - Two sessions below the range: the deload load, from the bottom of the range.
///
/// A planned load heavier than the history suggests wins (the plan was raised by hand); only a deload goes lower.
/// Warm-up slots keep their own target.
public enum SlotPlanner {
    public static func target(
        for slot: TemplateExercise,
        last: [LoggedSet],
        previous: [LoggedSet] = [],
        increment: Weight,
        unit: WeightUnit
    ) -> SetTarget {
        let planned = slot.weight.map { inUnit($0, unit: unit, increment: increment) }
        guard slot.kind != .warmUp else { return target(slot, reps: nil, weight: planned) }
        let suggestion = Progression.suggest(
            repRange: slot.repRange,
            last: last,
            previous: previous,
            increment: increment
        )
        switch suggestion {
        case .noHistory:
            return target(slot, reps: nil, weight: planned)
        case .increase(let weight, let reps):
            return target(slot, reps: reps, weight: heavier(planned, inUnit(weight, unit: unit, increment: increment)))
        case .repeatWeight(let reps):
            let lastWeight = heaviestWorking(last).map { inUnit($0, unit: unit, increment: increment) }
            return target(slot, reps: reps, weight: heavier(planned, lastWeight))
        case .deload(let weight):
            return target(
                slot,
                reps: slot.repRange.lowerBound,
                weight: inUnit(weight, unit: unit, increment: increment)
            )
        }
    }

    /// A slot that repeats an exercise's last session: as many sets as its working sets then, with their rep
    /// target; the defaults (3 × 8–12) when there is no history.
    public static func slot(
        id: UUID,
        exercise: Exercise,
        last: [LoggedSet],
        restSeconds: Int? = TemplateExercise.defaultRestSeconds
    ) -> TemplateExercise {
        let working = last.filter { $0.kind == .working }
        let reference = working.first?.target
        let range = reference?.repRange ?? reference?.reps.map { $0...$0 } ?? TemplateExercise.defaultRepRange
        return TemplateExercise(
            id: id,
            exerciseID: exercise.id,
            displayName: exercise.name,
            sets: working.isEmpty ? TemplateExercise.defaultSets : working.count,
            repRange: range,
            restSeconds: restSeconds
        )
    }

    private static func target(_ slot: TemplateExercise, reps: Int?, weight: Weight?) -> SetTarget {
        let range = slot.repRange
        if range.lowerBound == range.upperBound {
            return SetTarget(reps: range.lowerBound, weight: weight)
        }
        return SetTarget(reps: reps, repRange: range, weight: weight)
    }

    private static func heaviestWorking(_ sets: [LoggedSet]) -> Weight? {
        sets.filter { $0.kind == .working || $0.kind == .failure }
            .compactMap { $0.actual?.weight ?? $0.target.weight }
            .max { $0.converted(to: .kg).value < $1.converted(to: .kg).value }
    }

    private static func heavier(_ lhs: Weight?, _ rhs: Weight?) -> Weight? {
        guard let lhs else { return rhs }
        guard let rhs else { return lhs }
        return rhs.converted(to: lhs.unit).value > lhs.value ? rhs : lhs
    }

    /// `weight` in `unit`; a load converted from the other unit is rounded to the increment.
    private static func inUnit(_ weight: Weight, unit: WeightUnit, increment: Weight) -> Weight {
        weight.unit == unit ? weight : weight.converted(to: unit).rounded(to: increment)
    }
}
