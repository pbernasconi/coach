import ActivityKit
import Foundation

/// The workout as a Live Activity on the Lock Screen and in the Dynamic Island, from the first logged set until the
/// workout is finished: the set to do now, the rest after the last one, the progress, and buttons that log the set or move
/// on without unlocking the phone. Compiled by both the app, which starts and updates it, and the LiftWidgets extension,
/// which draws it (see `project.yml`). Display values only (PLAT-1).
nonisolated struct WorkoutActivityAttributes: ActivityAttributes, Codable, Hashable, Sendable {
    /// What changes while the workout runs.
    nonisolated struct ContentState: Codable, Hashable, Sendable {
        /// The set to do now; nil once no set is left planned.
        var current: WorkoutActivitySet?
        /// The current exercise's place in the workout, from 1.
        var exerciseNumber: Int
        var exerciseCount: Int
        /// One dot per set of the current exercise, in order.
        var dots: [WorkoutActivityDot]
        var loggedSets: Int
        var totalSets: Int
        /// The rest after the last logged set; nil while there is none. The system counts down to its end.
        var rest: RestSnapshot?
        /// The exercise after the current one ("Romanian deadlift"); nil on the last.
        var nextExercise: String?

        /// The share of sets logged, from 0 to 1.
        var progress: Double {
            totalSets > 0 ? min(1, Double(loggedSets) / Double(totalSets)) : 0
        }

        /// Every planned set is logged or skipped.
        var isComplete: Bool { current == nil }
    }

    /// The session, so the buttons log into the workout they show.
    var sessionID: UUID
    /// "Upper A".
    var title: String
}

/// The set the Lock Screen offers to log.
nonisolated struct WorkoutActivitySet: Codable, Hashable, Sendable {
    var id: UUID
    /// "Back squat".
    var exerciseName: String
    /// "Set 2", "Warm-up 1".
    var title: String
    /// "100"; nil when the set has no weight.
    var weight: String?
    /// "kg" or "lb".
    var unit: String
    /// "5" or "8–10"; nil when the set has no reps.
    var reps: String?
    /// The exercise's photo as a small JPEG (`WorkoutActivityStills`); nil without one.
    var still: Data?
}

extension WorkoutActivitySet {
    /// "100 kg × 5 reps" for the Lock Screen's bottom bar: the reps spelled out after a weight.
    var loadLine: String {
        switch (weight, reps) {
        case (let weight?, let reps?): String(localized: "\(weight) \(unit) × \(reps) reps")
        default: loadText
        }
    }

    /// "100 kg × 5", "12 reps" without a weight, "100 kg" without reps; the set's title with neither.
    var loadText: String {
        switch (weight, reps) {
        case (let weight?, let reps?): "\(weight) \(unit) × \(reps)"
        case (let weight?, nil): "\(weight) \(unit)"
        case (nil, let reps?): String(localized: "\(reps) reps")
        case (nil, nil): title
        }
    }
}

/// A set's dot in the current exercise's row.
nonisolated enum WorkoutActivityDot: String, Codable, Hashable, Sendable {
    case planned
    /// The set the Lock Screen offers now.
    case current
    case done
    case skipped
}

extension RestSnapshot {
    /// "2:00": the whole rest, beside the time rested.
    var limitText: String {
        let seconds = max(0, totalSeconds)
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    /// When the rest began, for the progress bar.
    var startsAt: Date { endsAt.addingTimeInterval(-TimeInterval(max(0, totalSeconds))) }

    /// The rest as a date range, for `Text(timerInterval:)` and `ProgressView(timerInterval:)`.
    var interval: ClosedRange<Date> { startsAt...endsAt }
}
