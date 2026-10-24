import Foundation

/// What the workout's dock shows at the bottom of the screen. It reads the same `ContentState` as the Lock Screen's Live
/// Activity, so the two always agree on the set to do now, the dots and the progress.
nonisolated enum WorkoutDockPhase: Equatable, Sendable {
    /// Nobody started the session: one big Start workout.
    case start
    /// Lifting: the set to do now, with Log set.
    case lifting(WorkoutActivityAttributes.ContentState, since: Date)
    /// Resting after a set: the time rested against the rest's length, and Skip.
    case resting(WorkoutActivityAttributes.ContentState, RestTimer, since: Date)
    /// The rest ran out: the next set, with how long ago it ended.
    case ready(WorkoutActivityAttributes.ContentState, RestReady, since: Date)
    /// Every set is logged or skipped: Finish workout.
    case complete(WorkoutActivityAttributes.ContentState, since: Date)
    /// Paused from the top bar: the clock stopped at `elapsed` seconds, with Finish and Resume.
    case paused(WorkoutActivityAttributes.ContentState, elapsed: Int)

    /// The Live Activity's view of the workout; nil before the start.
    var content: WorkoutActivityAttributes.ContentState? {
        switch self {
        case .start: nil
        case .lifting(let content, _), .resting(let content, _, _), .ready(let content, _, _),
            .complete(let content, _), .paused(let content, _):
            content
        }
    }

    /// When the workout started, moved on by the time paused, for the running clock; nil before the start and while
    /// paused.
    var since: Date? {
        switch self {
        case .start, .paused: nil
        case .lifting(_, let since), .resting(_, _, let since), .ready(_, _, let since), .complete(_, let since): since
        }
    }
}

extension WorkoutState {
    /// The dock for the loaded session: Start before it started, then the set, rest or finish; nil once finished, on an
    /// earlier day's untouched session, and while loading.
    var dock: WorkoutDockPhase? {
        guard case .loaded(let workout) = workout else { return nil }
        switch workout.clockPhase {
        case .finished, .pastDay:
            return nil
        case .notStarted:
            return .start
        case .paused(let elapsed):
            return .paused(workout.dockContent(currentSetID: workout.currentSetID(after: nil)), elapsed: elapsed)
        case .running(let since):
            if let rest {
                let content = workout.dockContent(currentSetID: workout.currentSetID(after: rest.setID))
                return .resting(content, rest, since: since)
            }
            if let ready, workout.isPlanned(ready.setID) {
                return .ready(workout.dockContent(currentSetID: ready.setID), ready, since: since)
            }
            let content = workout.dockContent(currentSetID: workout.currentSetID(after: nil))
            return content.current == nil ? .complete(content, since: since) : .lifting(content, since: since)
        }
    }
}

/// The running rest and the set it comes before, for that set's row (its check fills as a ring).
nonisolated struct SetRowRest: Equatable, Sendable {
    var setID: UUID
    var timer: RestTimer
}

extension WorkoutState {
    /// The rest running now and the set to do after it; nil while no rest runs.
    var setRowRest: SetRowRest? {
        guard case .resting(let content, let rest, _)? = dock, let setID = content.current?.id else { return nil }
        return SetRowRest(setID: setID, timer: rest)
    }

    /// The dock is on the first set of an exercise that follows a finished one, and Start was not tapped for it yet:
    /// it says "Next exercise" and offers Start.
    var dockIntroducesExercise: Bool {
        guard case .lifting(let content, _)? = dock, let set = content.current, content.loggedSets > 0,
            content.dots.first == .current, content.dots.dropFirst().allSatisfy({ $0 == .planned })
        else { return false }
        return set.id != startedExerciseSetID
    }

    /// The rest that logging the dock's set starts, for "Done · rest 2:00": none on the last planned set or when rests
    /// are off in Workout settings. Matches `SessionDetail.restSeconds(afterLogging:preferences:)`.
    var dockRestSeconds: Int {
        guard preferences.startsRest, case .loaded(let workout) = workout, let setID = dock?.content?.current?.id,
            let exercise = workout.exercises.first(where: { $0.sets.contains { $0.id == setID } })
        else { return 0 }
        let othersPlanned = workout.exercises.flatMap(\.sets).contains { $0.status == .planned && $0.id != setID }
        return othersPlanned ? exercise.restSeconds ?? preferences.defaultRestSeconds : 0
    }

    /// The dock shows Finish: every set is done, or the workout is paused.
    var dockFinishes: Bool {
        switch dock {
        case .complete?, .paused?: true
        default: false
        }
    }

    /// The list under the exercises offers Finish workout: the workout is under way, and the dock does not offer it
    /// already. Never before the start, when the dock says Start workout.
    var listOffersFinish: Bool {
        guard case .loaded(let workout) = workout, workout.startedAt != nil, !workout.isFinished else { return false }
        return !dockFinishes
    }

    /// Sets still planned, for "Finish workout?".
    var plannedSetsLeft: Int {
        guard case .loaded(let workout) = workout else { return 0 }
        return workout.exercises.flatMap(\.sets).count(where: { $0.status == .planned })
    }
}

extension WorkoutOverview {
    /// The set to do now: the next planned one after `setID` (the set a rest follows), else after the last set logged or
    /// skipped in workout order, else the first planned set. Nil when none is planned.
    func currentSetID(after setID: UUID?) -> UUID? {
        if let setID, let next = nextPlanned(after: setID) { return next.set.id }
        let sets = exercises.flatMap(\.sets)
        if let last = sets.lastIndex(where: { $0.status != .planned }), let next = nextPlanned(after: sets[last].id) {
            return next.set.id
        }
        return sets.first { $0.status == .planned }?.id
    }

    func dockContent(currentSetID: UUID?) -> WorkoutActivityAttributes.ContentState {
        WorkoutActivityAttributes.ContentState(overview: self, currentSetID: currentSetID, rest: nil)
    }
}
