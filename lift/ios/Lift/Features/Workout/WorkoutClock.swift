import Foundation

/// The workout clock in the Workout header: time since the start, worked out from the stored start and the time now
/// (never counted up by a timer), so it is right after the app was in the background or relaunched.
nonisolated enum WorkoutClock {
    /// The longest a running workout shows on the clock. An unfinished session that started longer ago (an import
    /// without a finish, a session left open) shows its start time instead of a clock at "37:12:09".
    static let limit = 12 * 60 * 60

    /// Whole seconds from `start` to `end`, never below zero.
    static func seconds(from start: Date, to end: Date) -> Int {
        max(0, Int(end.timeIntervalSince(start).rounded(.down)))
    }

    /// "04:05" under an hour, "1:02:03" from an hour on.
    static func text(seconds: Int) -> String {
        let seconds = max(0, seconds)
        let hours = seconds / 3600
        let minutes = seconds / 60 % 60
        let rest = seconds % 60
        let mmss = String(format: "%02d:%02d", minutes, rest)
        return hours > 0 ? "\(hours):\(mmss)" : mmss
    }

    /// "4 minutes, 5 seconds", for VoiceOver.
    static func spoken(seconds: Int) -> String {
        Duration.seconds(max(0, seconds)).formatted(.units(allowed: [.hours, .minutes, .seconds], width: .wide))
    }
}

/// What the Workout header shows about the time.
nonisolated enum WorkoutClockPhase: Equatable, Sendable {
    /// Not started and not finished: the Start button.
    case notStarted
    /// Started and not finished: the live clock from this start, moved on by the time paused so far.
    case running(since: Date)
    /// Paused: the clock stopped at this many seconds.
    case paused(elapsed: Int)
    /// Finished: no clock and no button (the day line says "Finished" and the time it took).
    case finished
    /// An earlier day's session that nobody started: nothing (Start would stamp today's time on it).
    case pastDay
}

extension WorkoutOverview {
    var clockPhase: WorkoutClockPhase {
        if isFinished { return .finished }
        if let startedAt {
            let paused = TimeInterval(pausedSeconds)
            if let pausedAt { return .paused(elapsed: WorkoutClock.seconds(from: startedAt + paused, to: pausedAt)) }
            return .running(since: startedAt + paused)
        }
        return isPastDay ? .pastDay : .notStarted
    }

    /// The time the finished workout took ("52:10"), pauses left out; nil while it runs or when the start is unknown.
    var durationText: String? {
        guard let startedAt, let finishedAt, finishedAt >= startedAt else { return nil }
        return WorkoutClock.text(seconds: WorkoutClock.seconds(from: startedAt, to: finishedAt) - pausedSeconds)
    }
}
