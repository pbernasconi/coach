import Foundation

/// `GET /api/app/plan/{id}` (lift/APP-API.md, "Planned workout"): one planned workout as the web's workout window
/// shows it. Every text is ready to show.
public struct AppPlannedWorkout: Decodable, Equatable, Sendable {
    public var id: String
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
    /// "How did it feel", from the workout's day on; nil before it, or when it did not load.
    public var feedback: WorkoutFeedback?

    /// The path of the plan activity `id` (the Week API item's id).
    public static func path(_ id: String) -> String { "api/app/plan/\(id)" }
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
    public var profile: [CoachProfileBar]
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

/// A step ("10:00", "Warm-up", "157–210 W", "Z2") or a repeat ("6 ×" and its steps, one level deep).
public struct PlannedStep: Decodable, Equatable, Sendable {
    /// `step` or `repeat`.
    public var kind: String
    public var label: String
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
    public var seconds: Double
    /// "45", "1:10", or "–".
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
