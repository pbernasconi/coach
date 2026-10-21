import Foundation
import LiftStore

/// What the rest Live Activity shows once a set is logged.
nonisolated struct RestActivityStart: Equatable, Sendable {
    var attributes: RestActivityAttributes
    /// "Set 3 · 5 @ 100 kg", with the exercise name first when it is another exercise; nil when none is planned.
    var nextSetLabel: String?
}

extension WorkoutState {
    /// The Live Activity for logging `setID`, or nil while the session is not loaded or the set is unknown.
    func restActivity(afterLogging setID: UUID) -> RestActivityStart? {
        guard case .loaded(let overview) = workout else { return nil }
        return overview.restActivity(afterLogging: setID)
    }

    /// A rest that Done on the Lock Screen started (`outside`, for its set) shows in the app too, from full for that set
    /// as a tick here does, with the time it has left at `now`. Nothing happens without one.
    mutating func adoptRest(_ outside: RestSnapshot?, at now: Date) {
        guard let outside, let setID = outside.setID else { return }
        beginRest(seconds: outside.totalSeconds, setID: setID)
        rest = rest?.capped(at: outside.secondsLeft(at: now))
    }
}

extension WorkoutOverview {
    /// The logged set's exercise and title, and the next planned set after it (wrapping to earlier ones).
    func restActivity(afterLogging setID: UUID) -> RestActivityStart? {
        let rows = exercises.flatMap { exercise in exercise.sets.map { (exercise: exercise, set: $0) } }
        guard let index = rows.firstIndex(where: { $0.set.id == setID }) else { return nil }
        let logged = rows[index]
        let later = rows[(index + 1)...] + rows[..<index]
        let next = later.first { $0.set.status == .planned }
        let nextLabel = next.map { row in
            let parts = row.exercise.id == logged.exercise.id ? [] : [row.exercise.name]
            return (parts + [row.set.title, row.set.target]).joined(separator: " · ")
        }
        return RestActivityStart(
            attributes: RestActivityAttributes(exerciseName: logged.exercise.name, setLabel: logged.set.title),
            nextSetLabel: nextLabel
        )
    }
}
