import Foundation

/// Works out a finished workout's `WorkoutSummary`.
public enum WorkoutSummarizer {
    /// `earlier` holds every set of each library exercise logged before this workout, by `Exercise.id`. An exercise
    /// with no earlier sets sets no record: a first time is not a best. Volume is in `unit`.
    public static func summarize(_ session: Session, earlier: [UUID: [LoggedSet]], unit: WeightUnit) -> WorkoutSummary {
        let done = session.exercises.flatMap { exercise in exercise.sets.filter(\.isDone) }
        let volume = session.exercises.reduce(0.0) { total, exercise in
            total + exercise.sets.reduce(0.0) { $0 + self.volume(of: $1, loadMode: exercise.loadMode, unit: unit) }
        }
        return WorkoutSummary(
            duration: duration(session, done: done),
            setsLogged: done.count,
            volume: Weight((volume * 100).rounded() / 100, unit),
            bests: bests(session, earlier: earlier)
        )
    }

    /// One done, non-warm-up set's reps × load in `unit`. Two dumbbells (`perHand`) and plates per side (`perSide`)
    /// count twice (the bar itself is not known, so it is left out); bodyweight counts only added load.
    public static func volume(of set: LoggedSet, loadMode: LoadMode, unit: WeightUnit) -> Double {
        guard set.isDone, set.kind != .warmUp, let reps = set.actual?.reps, reps > 0 else { return 0 }
        let logged: Weight? =
            if case .bodyweight(let added) = loadMode { set.actual?.weight ?? added } else { set.actual?.weight }
        guard let logged, logged.value > 0 else { return 0 }
        let factor: Double =
            switch loadMode {
            case .perHand, .perSide: 2
            case .total, .bodyweight: 1
            }
        return logged.converted(to: unit).value * Double(reps) * factor
    }

    private static func duration(_ session: Session, done: [LoggedSet]) -> TimeInterval? {
        let stamps = done.compactMap { $0.actual?.completedAt }
        guard let start = session.startedAt ?? stamps.min(), let end = session.finishedAt ?? stamps.max() else {
            return nil
        }
        let seconds = end.timeIntervalSince(start)
        return seconds > 0 ? seconds : nil
    }

    private static func bests(_ session: Session, earlier: [UUID: [LoggedSet]]) -> [PersonalBest] {
        var seen: Set<UUID> = []
        return session.exercises.flatMap { exercise -> [PersonalBest] in
            guard let id = exercise.exerciseID, seen.insert(id).inserted else { return [] }
            let before = earlier[id] ?? []
            guard before.contains(where: \.isDone) else { return [] }
            let now = session.exercises.filter { $0.exerciseID == id }.flatMap(\.sets)
            let mode = exercise.loadMode
            let candidates: [(PersonalBest.Kind, Weight?, Weight?)] = [
                (
                    .estimatedOneRepMax, OneRepMax.best(in: now, loadMode: mode),
                    OneRepMax.best(in: before, loadMode: mode)
                ),
                (.weight, heaviest(now), heaviest(before)),
            ]
            return candidates.compactMap { kind, value, previous in
                guard let value, let previous, isHeavier(value, than: previous) else { return nil }
                return PersonalBest(
                    exerciseID: id,
                    exerciseName: exercise.displayName,
                    kind: kind,
                    value: value,
                    previous: previous
                )
            }
        }
    }

    private static func heaviest(_ sets: [LoggedSet]) -> Weight? {
        sets.filter { $0.isDone && $0.kind != .warmUp }
            .compactMap { $0.actual?.weight }
            .filter { $0.value > 0 }
            .max { $0.converted(to: .kg).value < $1.converted(to: .kg).value }
    }

    /// Strictly heavier, ignoring rounding noise from unit conversion (under 0.01 kg).
    private static func isHeavier(_ value: Weight, than other: Weight) -> Bool {
        value.converted(to: .kg).value - other.converted(to: .kg).value > 0.01
    }
}
