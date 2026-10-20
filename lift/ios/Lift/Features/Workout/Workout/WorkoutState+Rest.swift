import Foundation

/// What the rest bar shows once the rest ran out: the next planned set and how long ago the rest ended.
nonisolated struct RestReady: Equatable, Sendable {
    /// The next planned set; "Log set" logs it.
    let setID: UUID
    /// "Back squat · Set 3".
    let title: String
    /// "5 @ 110 kg".
    let target: String
    /// When the rest ran out; the bar counts up from here.
    let since: Date
}

extension WorkoutOverview {
    /// The first planned set after `setID`, wrapping round to earlier ones; nil when none is left.
    func nextPlanned(after setID: UUID) -> (exercise: WorkoutExercise, set: WorkoutSetItem)? {
        let rows = exercises.flatMap { exercise in exercise.sets.map { (exercise: exercise, set: $0) } }
        guard let index = rows.firstIndex(where: { $0.set.id == setID }) else { return nil }
        return (rows[(index + 1)...] + rows[..<index]).first { $0.set.status == .planned }
    }

    /// The "rest over" bar for the set after `setID`, or nil when nothing is left to lift.
    func restReady(after setID: UUID, since: Date) -> RestReady? {
        guard let next = nextPlanned(after: setID) else { return nil }
        return RestReady(
            setID: next.set.id,
            title: "\(next.exercise.name) · \(next.set.title)",
            target: next.set.target,
            since: since
        )
    }

    /// Whether `setID` is still planned (not logged, skipped or removed since).
    func isPlanned(_ setID: UUID) -> Bool {
        exercises.contains { $0.sets.contains { $0.id == setID && $0.status == .planned } }
    }

    /// "Back squat · Set 2": the set a rest follows, for the rest bar; nil when the set is gone.
    func restLabel(for setID: UUID) -> String? {
        for exercise in exercises {
            if let set = exercise.sets.first(where: { $0.id == setID }) { return "\(exercise.name) · \(set.title)" }
        }
        return nil
    }
}

extension WorkoutState {
    /// A new rest from full for `setID`, replacing any rest still running; none for a zero rest. The "rest over" bar
    /// goes away.
    mutating func beginRest(seconds: Int, setID: UUID) {
        ready = nil
        rest = seconds > 0 ? RestTimer(run: (rest?.run ?? 0) + 1, seconds: seconds, setID: setID) : nil
    }

    /// The rest after `setID` ran out: the bar turns to the next planned set, or goes away when none is left.
    mutating func readyNext(after setID: UUID?, at date: Date) {
        rest = nil
        guard let setID, case .loaded(let overview) = workout else {
            ready = nil
            return
        }
        ready = overview.restReady(after: setID, since: date)
    }
}
