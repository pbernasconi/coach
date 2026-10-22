import Foundation

/// What the workout's dock shows at the bottom of the screen. It reads the same `ContentState` as the Lock Screen's Live
/// Activity, so the two always agree on the set to do now, the dots and the progress.
nonisolated enum WorkoutDockPhase: Equatable, Sendable {
    /// Nobody started the session: one big Start workout.
    case start
    /// Lifting: the set to do now, with Log set.
    case lifting(WorkoutActivityAttributes.ContentState, since: Date)
    /// Resting after a set: the countdown, +30s and Skip.
    case resting(WorkoutActivityAttributes.ContentState, RestTimer, since: Date)
    /// The rest ran out: the next set, with how long ago it ended.
    case ready(WorkoutActivityAttributes.ContentState, RestReady, since: Date)
    /// Every set is logged or skipped: Finish workout.
    case complete(WorkoutActivityAttributes.ContentState, since: Date)

    /// The Live Activity's view of the workout; nil before the start.
    var content: WorkoutActivityAttributes.ContentState? {
        switch self {
        case .start: nil
        case .lifting(let content, _), .resting(let content, _, _), .ready(let content, _, _),
            .complete(let content, _):
            content
        }
    }

    /// When the workout started, for the clock.
    var since: Date? {
        switch self {
        case .start: nil
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
