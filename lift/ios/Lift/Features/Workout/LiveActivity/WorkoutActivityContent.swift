import Foundation
import LiftCore
import LiftStore

extension SessionDetail {
    /// The workout is under way: not finished, and started or with a set logged or skipped. Its Live Activity shows from
    /// then until it is finished.
    var isUnderway: Bool {
        session.finishedAt == nil
            && (session.startedAt != nil || items.contains { $0.sets.contains { $0.status != .planned } })
    }

    /// The set the Lock Screen offers: `focus` while it is still planned; otherwise the first planned set after the one
    /// logged last (wrapping to earlier ones), or the first planned set before anything is logged. Nil when none is
    /// planned.
    func activitySetID(focus: UUID?) -> UUID? {
        let sets = items.flatMap(\.sets)
        if let focus, sets.contains(where: { $0.id == focus && $0.status == .planned }) { return focus }
        let logged = sets.indices.filter { sets[$0].status == .done }
        let last = logged.max { first, second in
            (sets[first].completedAt ?? .distantPast, first) < (sets[second].completedAt ?? .distantPast, second)
        }
        guard let last else { return sets.first { $0.status == .planned }?.id }
        return plannedSet(after: sets[last].id)
    }

    /// The first planned set after `setID` in workout order, wrapping to earlier ones; nil when no other set is planned.
    func plannedSet(after setID: UUID) -> UUID? {
        let sets = items.flatMap(\.sets)
        guard let index = sets.firstIndex(where: { $0.id == setID }) else {
            return sets.first { $0.status == .planned }?.id
        }
        let later = sets[(index + 1)...] + sets[..<index]
        return later.first { $0.status == .planned }?.id
    }
}

extension WorkoutActivityAttributes.ContentState {
    /// The Lock Screen's view of `overview`, with `currentSetID` as the set to do now and `rest` running. With no current
    /// set, the last exercise stands in for the dots.
    init(overview: WorkoutOverview, currentSetID: UUID?, rest: RestSnapshot?) {
        let exercises = overview.exercises
        let index = currentSetID.flatMap { id in exercises.firstIndex { $0.sets.contains { $0.id == id } } }
        let exercise = index.map { exercises[$0] } ?? exercises.last
        let set = exercise?.sets.first { $0.id == currentSetID }
        let sets = exercises.flatMap(\.sets)
        self.init(
            current: exercise.flatMap { exercise in set.map { WorkoutActivitySet(set: $0, in: exercise) } },
            exerciseNumber: (index ?? max(0, exercises.count - 1)) + 1,
            exerciseCount: exercises.count,
            dots: exercise?.sets.map { $0.id == currentSetID ? .current : WorkoutActivityDot($0.status) } ?? [],
            loggedSets: sets.count(where: { $0.status != .planned }),
            totalSets: sets.count,
            rest: rest,
            nextExercise: index.flatMap { exercises.indices.contains($0 + 1) ? exercises[$0 + 1].name : nil }
        )
    }
}

extension WorkoutActivitySet {
    /// `set` of `exercise`, with the row's weight and reps pills ("—" becomes nil).
    init(set: WorkoutSetItem, in exercise: WorkoutExercise) {
        self.init(
            id: set.id,
            exerciseName: exercise.name,
            title: set.title,
            weight: set.weight == "—" ? nil : set.weight,
            unit: exercise.unit.rawValue,
            reps: set.reps == "—" ? nil : set.reps
        )
    }
}

extension WorkoutActivityDot {
    init(_ status: SetStatus) {
        switch status {
        case .planned: self = .planned
        case .done: self = .done
        case .skipped: self = .skipped
        }
    }
}
