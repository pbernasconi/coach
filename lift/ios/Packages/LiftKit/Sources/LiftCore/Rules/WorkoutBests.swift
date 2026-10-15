import Foundation

/// The records a workout beat, one `PersonalBest` per library exercise.
public enum WorkoutBests {
    /// Estimated one-rep maxes are rounded to this step, in the summary's unit, before they are compared or shown: an
    /// estimate is not precise to a tenth, and a "record" by rounding noise is not one.
    public static let estimateStep = 0.5

    /// `earlier` holds every set of each library exercise logged before this workout, by `Exercise.id`. An exercise
    /// with no earlier sets sets no record: a first time is not a best.
    public static func bests(_ session: Session, earlier: [UUID: [LoggedSet]], unit: WeightUnit) -> [PersonalBest] {
        var seen: Set<UUID> = []
        return session.exercises.compactMap { exercise in
            guard let id = exercise.exerciseID, seen.insert(id).inserted else { return nil }
            let before = earlier[id] ?? []
            guard before.contains(where: \.isDone) else { return nil }
            let sets = session.exercises.filter { $0.exerciseID == id }.flatMap(\.sets)
            return best(of: exercise, sets: sets, before: before, unit: unit)
        }
    }

    private static func best(of exercise: SessionExercise, sets: [LoggedSet], before: [LoggedSet], unit: WeightUnit)
        -> PersonalBest?
    {
        let mode = exercise.loadMode
        let working = sets.filter { $0.isDone && $0.kind != .warmUp }
        let heaviestSet = heaviest(working)
        let heaviestRecord = record(
            heaviestSet?.actual?.weight,
            previous: heaviest(before.filter { $0.isDone && $0.kind != .warmUp })?.actual?.weight,
            in: unit,
            step: 0
        )
        let estimateSet = working.max { kilograms(oneRepMax($0, mode)) < kilograms(oneRepMax($1, mode)) }
        let estimate = estimateSet.flatMap { oneRepMax($0, mode) }.map { rounded($0, in: unit) }
        let estimateRecord = record(
            estimate,
            previous: OneRepMax.best(in: before, loadMode: mode),
            in: unit,
            step: estimateStep
        )
        let shown = heaviestRecord != nil ? heaviestSet : estimateSet
        guard heaviestRecord != nil || estimateRecord != nil, let shown, let reps = shown.actual?.reps else {
            return nil
        }
        return PersonalBest(
            exerciseID: exercise.exerciseID ?? exercise.id,
            exerciseName: exercise.displayName,
            heaviest: heaviestRecord,
            estimatedOneRepMax: estimateRecord,
            topSet: PersonalBest.TopSet(weight: load(shown, mode), reps: reps),
            estimate: estimate
        )
    }

    /// The done set with the heaviest load; among equal loads, the one with more reps.
    private static func heaviest(_ sets: [LoggedSet]) -> LoggedSet? {
        sets.filter { ($0.actual?.weight?.value ?? 0) > 0 }
            .max { lhs, rhs in
                let left = kilograms(lhs.actual?.weight)
                let right = kilograms(rhs.actual?.weight)
                guard abs(left - right) > 0.01 else { return (lhs.actual?.reps ?? 0) < (rhs.actual?.reps ?? 0) }
                return left < right
            }
    }

    /// A record when `value` beats `previous` (rounded to `step` in `unit` first, when `step` is positive); nil when
    /// either is missing or it does not.
    private static func record(_ value: Weight?, previous: Weight?, in unit: WeightUnit, step: Double)
        -> PersonalBest.Record?
    {
        guard let value, let previous else { return nil }
        let new = step > 0 ? rounded(value, in: unit) : value
        let old = step > 0 ? rounded(previous, in: unit) : previous
        guard kilograms(new) - kilograms(old) > 0.01 else { return nil }
        return PersonalBest.Record(value: new, previous: old)
    }

    private static func oneRepMax(_ set: LoggedSet, _ mode: LoadMode) -> Weight? {
        OneRepMax.estimate(set: set, loadMode: mode)
    }

    /// The load a set was lifted with: the logged weight, or a bodyweight exercise's added load.
    private static func load(_ set: LoggedSet, _ mode: LoadMode) -> Weight? {
        if case .bodyweight(let added) = mode { return set.actual?.weight ?? added }
        return set.actual?.weight
    }

    private static func rounded(_ weight: Weight, in unit: WeightUnit) -> Weight {
        weight.converted(to: unit).rounded(toStep: estimateStep)
    }

    private static func kilograms(_ weight: Weight?) -> Double {
        weight?.converted(to: .kg).value ?? 0
    }
}
