import Foundation

/// The workout under way, as the bar above the tab bar shows it while the Workout screen is closed: its name, its clock,
/// and one line on what is happening now (the set to do, the rest, or the pause). Pure values (TEST-3): the view passes
/// the time, so the bar's text follows the same wall clock as the Workout header and the Lock Screen.
nonisolated struct ActiveWorkoutBar: Equatable, Sendable {
    var sessionID: UUID
    /// "Heavy barbell".
    var title: String
    /// Running since a start (pauses taken out), or stopped at a time while paused.
    var clock: WorkoutClockPhase
    /// "Back squat"; nil once no set is left planned.
    var exerciseName: String?
    /// "Set 3", "Warm-up 1".
    var setTitle: String?
    /// The rest after the last logged set, as the Workout screen and the Lock Screen left it.
    var rest: RestSnapshot?
    /// The share of sets logged or skipped, from 0 to 1.
    var progress: Double

    var isPaused: Bool {
        if case .paused = clock { return true }
        return false
    }

    /// The rest still running at `now`; nil once it is over or while the workout is paused.
    func runningRest(at now: Date) -> RestSnapshot? {
        guard !isPaused, let rest, rest.endsAt > now else { return nil }
        return rest
    }

    /// The workout clock at `now`: "32:15", or where it stopped while paused. Nil for a clock past
    /// `WorkoutClock.limit` (a session left open), or one that never started.
    func clockText(at now: Date) -> String? {
        let seconds: Int
        switch clock {
        case .running(let since): seconds = WorkoutClock.seconds(from: since, to: now)
        case .paused(let elapsed): seconds = elapsed
        case .notStarted, .finished, .pastDay: return nil
        }
        return seconds <= WorkoutClock.limit ? WorkoutClock.text(seconds: seconds) : nil
    }

    /// The second line: "Paused", "Rest 0:36 / 2:00" (counting up, as in the Workout screen and on the Lock Screen),
    /// "Back squat · Set 3", or "All sets done".
    func detailText(at now: Date) -> String {
        if isPaused { return String(localized: "Paused") }
        if let rest = runningRest(at: now) {
            let rested = max(0, rest.totalSeconds - rest.secondsLeft(at: now))
            return String(localized: "Rest \(Self.restClock(rested)) / \(Self.restClock(rest.totalSeconds))")
        }
        guard let exerciseName else { return String(localized: "All sets done") }
        guard let setTitle else { return exerciseName }
        return "\(exerciseName) · \(setTitle)"
    }

    /// How far the ring is filled at `now`: the rest rested so far while resting (it fills up, like the rest ring on
    /// the next set), else the sets done.
    func ringProgress(at now: Date) -> Double {
        guard let rest = runningRest(at: now), rest.totalSeconds > 0 else { return min(1, max(0, progress)) }
        let rested = Double(rest.totalSeconds) - rest.endsAt.timeIntervalSince(now)
        return min(1, max(0, rested / Double(rest.totalSeconds)))
    }

    /// "0:36", "2:00": minutes and seconds, as the rest rows write them.
    private static func restClock(_ value: Int) -> String {
        let value = max(0, value)
        return String(format: "%d:%02d", value / 60, value % 60)
    }
}
