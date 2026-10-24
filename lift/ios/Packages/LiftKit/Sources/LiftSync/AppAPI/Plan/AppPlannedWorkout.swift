import Foundation

/// `GET /api/app/plan/{id}` (lift/APP-API.md, "Planned workout"): one planned workout as the web's workout window
/// shows it. Every text is ready to show.
public struct AppPlannedWorkout: Decodable, Equatable, Sendable {
    public var id: String
    /// The day, "2026-10-22".
    public var date: String?
    public var title: String
    /// An id from `design/sports.json`.
    public var sport: String
    /// "Wednesday, October 21 · 07:00 · Ride".
    public var subtitle: String
    /// `planned | today | done | missed | skipped`.
    public var state: String
    /// "Today", "Done", "Partly done", "Not done"…
    public var stateLabel: String
    /// `good | partial | off` once done.
    public var compliance: String?
    public var adapted: Bool
    public var hero: [PlannedHeroStat]
    /// Nil without structured steps.
    public var workout: PlannedStructure?
    public var intensity: String?
    public var notes: String?
    public var liftSessionId: String?
    public var done: PlannedDone?
    /// A strength workout's exercises, read from the coach's text, until a Lift session is linked; nil from an older
    /// server.
    public var exercises: [PlannedExercise]?
    /// "How did it feel", from the workout's day on; nil before it, or when it did not load.
    public var feedback: WorkoutFeedback?

    /// The path of the plan activity `id` (the Week API item's id).
    public static func path(_ id: String) -> String { "api/app/plan/\(id)" }

    /// `PUT` here marks it done, skipped or planned again (APP-API.md, "Workout status").
    public static func statusPath(_ id: String) -> String { "api/app/plan/\(id)/status" }

    /// `PUT` here moves it to another day, `{ "date": "YYYY-MM-DD" }` (APP-API.md, "Move a workout"). `DELETE` on
    /// `path(_:)` deletes it ("Delete a workout").
    public static func datePath(_ id: String) -> String { "api/app/plan/\(id)/date" }

    /// `PUT` here links the Lift session started for it (APP-API.md, "Workout Lift session").
    public static func liftSessionPath(_ id: String) -> String { "api/app/plan/\(id)/lift-session" }
}

/// One exercise of a strength workout: "Standing calf raise", 3 × 15, and the coach's words for it.
public struct PlannedExercise: Decodable, Equatable, Sendable, Identifiable {
    public var name: String
    public var sets: Int
    public var reps: Int
    /// The top of a range ("3 × 8–10"); nil for one number.
    public var repsMax: Int?
    public var note: String?

    public var id: String { name }

    /// The reps to plan: `reps`, or `reps...repsMax`.
    public var repRange: ClosedRange<Int> {
        guard let repsMax, repsMax > reps else { return reps...reps }
        return reps...repsMax
    }

    public init(name: String, sets: Int, reps: Int, repsMax: Int? = nil, note: String? = nil) {
        self.name = name
        self.sets = sets
        self.reps = reps
        self.repsMax = repsMax
        self.note = note
    }
}

/// One of the numbers at the top: "Planned time" "1:30".
public struct PlannedHeroStat: Decodable, Equatable, Sendable {
    public var label: String
    public var valueText: String
    public var unit: String?
}

/// The workout card: the main work, the interval chart, every step and the time in each zone.
public struct PlannedStructure: Decodable, Equatable, Sendable {
    /// "1:30:00 · 95 TSS · IF 0.79".
    public var summaryText: String
    public var keyTargets: [PlannedKeyTarget]
    /// The chart's bars, each with what a tap on it shows.
    public var profile: [PlannedBar]
    public var ticks: [PlannedTick]
    public var steps: [PlannedStep]
    public var zones: PlannedZones?
}

/// "6 × 5:00 at 254–276 W, 2:00 easy", with the zone of its work.
public struct PlannedKeyTarget: Decodable, Equatable, Sendable {
    public var text: String
    public var zone: String
}

/// A time label under the chart, at `at` (0…1) along it.
public struct PlannedTick: Decodable, Equatable, Sendable {
    public var at: Double
    public var text: String
}

/// One bar of the interval chart, and what a tap on it shows (as the web chart's tooltip).
public struct PlannedBar: Decodable, Equatable, Sendable {
    public var seconds: Double
    public var from: Double
    public var to: Double
    public var zone: String
    /// The `id` of its row in the step list.
    public var stepId: String?
    /// "Work · 2 of 6".
    public var title: String?
    public var lengthText: String?
    public var targetText: String?
    /// "95–104% FTP".
    public var percentText: String?
    /// "17:00 → 22:00".
    public var timeText: String?
    /// The coach's words for the step.
    public var cue: String?
}

/// A step ("10:00", "Work", "157–210 W", "Z2") or a repeat ("6 ×" and its steps, one level deep).
public struct PlannedStep: Decodable, Equatable, Sendable {
    /// `step` or `repeat`.
    public var kind: String
    /// Ties the step to its bars in the chart (`PlannedBar.stepId`).
    public var id: String?
    public var label: String
    /// The coach's words for the step, shown when it is picked.
    public var cue: String?
    public var length: String?
    public var target: String?
    public var zone: String?
    public var steps: [PlannedStep]?
}

/// Planned time in each zone: "by power" or "by heart rate", and Z1–Z5.
public struct PlannedZones: Decodable, Equatable, Sendable {
    public var basis: String
    public var items: [PlannedZoneTime]
}

public struct PlannedZoneTime: Decodable, Equatable, Sendable {
    public var zone: String
    /// "Endurance".
    public var name: String?
    /// "148–200 W".
    public var rangeText: String?
    public var seconds: Double
    /// "58 min"; empty for none.
    public var timeText: String
    public var percent: Int
}

/// What completed the workout: the Strava activity to open, or nil for a Lift session.
public struct PlannedDone: Decodable, Equatable, Sendable {
    public var activityId: String?
    public var name: String?

    public init(activityId: String?, name: String?) {
        self.activityId = activityId
        self.name = name
    }
}
