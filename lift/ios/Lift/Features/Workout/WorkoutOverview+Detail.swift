import Foundation
import LiftCore
import LiftStore

extension WorkoutOverview {
    /// The screen's view of a stored session, with hints worked out by the LiftCore rules and each set's values last
    /// time from `previous` (by library exercise id).
    init(detail: SessionDetail, days: DayCalendar, previous: [UUID: PreviousSets]) {
        let sets = detail.items.flatMap(\.sets)
        self.init(
            title: detail.session.title,
            dayTitle: days.longTitle(of: detail.session.day),
            loggedSets: sets.count(where: { $0.status == .done }),
            totalSets: sets.count,
            exercises: detail.items.map { item in
                let last = item.exercise.exerciseID.flatMap { previous[$0] }
                return WorkoutExercise(item: item, unit: detail.session.unitsAtLog, previous: last)
            },
            note: detail.session.note,
            warmUpNote: detail.session.warmUpNote
        )
    }
}

extension WorkoutExercise {
    init(item: SessionDetail.Item, unit: WeightUnit, previous: PreviousSets?) {
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
            progression: Self.progression(item: item, working: working),
            sets: Self.rows(item.sets, previous: previous),
            libraryID: exercise.exerciseID,
            catalogID: item.catalogID,
            unit: item.sets.first?.unit ?? unit,
            note: WorkoutText.exerciseNote(exercise.note, hasHint: exercise.nextTimeHint != nil)
        )
    }

    /// Once every working set is logged or skipped, the next target from `Progression`; otherwise a weight the user
    /// wrote down for next time, if any.
    private static func progression(item: SessionDetail.Item, working: [SetRecord]) -> String? {
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

    /// Set rows, numbered within each kind ("Warm-up 1", "Set 1", "Set 2"), each with the same set last time.
    private static func rows(_ sets: [SetRecord], previous: PreviousSets?) -> [WorkoutSetItem] {
        var counts: [SetKind: Int] = [:]
        return sets.map { set in
            let number = (counts[set.kind] ?? 0) + 1
            counts[set.kind] = number
            let last = previous?.set(kind: set.kind, number: number)
            return WorkoutSetItem(
                id: set.id,
                title: WorkoutText.setTitle(number: number, kind: set.kind),
                target: WorkoutText.target(set.target),
                actual: WorkoutText.values(reps: set.actualReps, weight: set.actualWeight),
                status: set.status,
                badge: WorkoutText.badge(number: number, kind: set.kind),
                weight: WorkoutText.pill(set.actualWeight ?? set.target.weight, unit: set.unit),
                reps: WorkoutText.pill(reps: set.actualReps, target: set.target),
                previous: last.flatMap { WorkoutText.previous($0, unit: set.unit) },
                note: set.note
            )
        }
    }
}

extension SessionDetail {
    /// The set with `setID` and the exercise it belongs to, or nil when the session has no such set.
    func find(setID: UUID) -> (Item, SetRecord)? {
        for item in items {
            if let set = item.sets.first(where: { $0.id == setID }) { return (item, set) }
        }
        return nil
    }
}

extension SessionDetail.Item {
    /// The set's number within its kind, from 1.
    func number(of set: SetRecord) -> Int {
        sets.prefix(while: { $0.id != set.id }).count(where: { $0.kind == set.kind }) + 1
    }

    /// The planned sets of the same kind after `set`, in order.
    func laterPlanned(after set: SetRecord) -> [SetRecord] {
        sets.drop(while: { $0.id != set.id }).dropFirst().filter { $0.kind == set.kind && $0.status == .planned }
    }
}

extension SetEditor {
    /// An editor over `set`, starting from its saved values or, when there are none, its target.
    init(set: SetRecord, title: String, lastTime: String?, laterSets: Int) {
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
            savedReps: reps,
            lastTime: lastTime,
            laterSets: laterSets
        )
    }

    /// An editor over `set` in `item`, with the same set last time from `previous` (by library exercise id).
    init(set: SetRecord, in item: SessionDetail.Item, previous: [UUID: PreviousSets], days: DayCalendar) {
        let number = item.number(of: set)
        let previous = item.exercise.exerciseID.flatMap { previous[$0] }
        let title = [WorkoutText.setTitle(number: number, kind: set.kind), item.exercise.displayName]
        let lastTime = previous.flatMap { previous in
            previous.set(kind: set.kind, number: number).flatMap {
                WorkoutText.lastTime($0, unit: set.unit, day: days.shortTitle(of: previous.day))
            }
        }
        self.init(
            set: set,
            title: title.joined(separator: " · "),
            lastTime: lastTime,
            laterSets: item.laterPlanned(after: set).count
        )
    }

    /// The later planned sets of the same kind that Done also saves `weight` onto: only with "Apply to later sets" on
    /// and a new weight, and only those that do not already hold it.
    func laterSets(in item: SessionDetail.Item, weight: Weight?) -> [SetRecord] {
        guard appliesToLater, let weight, self.weight != savedWeight, let set = item.sets.first(where: { $0.id == id })
        else { return [] }
        return item.laterPlanned(after: set).filter {
            ($0.actualWeight ?? $0.target.weight)?.converted(to: unit) != weight
        }
    }
}
