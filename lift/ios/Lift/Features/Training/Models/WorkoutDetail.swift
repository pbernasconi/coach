import Foundation
import LiftSync

/// `GET /api/app/workouts/{ref}` (lift/APP-API.md, "Workout"): one workout, planned and done as one. `plan` is what the
/// coach planned and `activity` what was done; either can be nil, and one "How did it feel" covers both.
nonisolated struct WorkoutDetail: Decodable, Equatable, Sendable {
    /// `plan-<id>` or `strava-<id>`.
    var ref: String
    /// `planned` or `done`.
    var state: String
    var title: String
    var plan: AppPlannedWorkout?
    var activity: ActivityDetail?
    var feedback: WorkoutFeedback?

    static func path(_ ref: String) -> String { "api/app/workouts/\(ref)" }

    /// The ref of a plan workout, and of a Strava activity.
    static func planRef(_ id: String) -> String { "plan-\(id)" }
    static func stravaRef(_ id: String) -> String { "strava-\(id)" }

    private enum Keys: String, CodingKey { case ref, state, title, plan, activity, feedback }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        ref = try c.decode(String.self, forKey: .ref)
        state = (try? c.decode(String.self, forKey: .state)) ?? "planned"
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        // Each half on its own: one that does not decode leaves the other one showing.
        plan = try? c.decodeIfPresent(AppPlannedWorkout.self, forKey: .plan)
        activity = try? c.decodeIfPresent(ActivityDetail.self, forKey: .activity)
        feedback = try? c.decodeIfPresent(WorkoutFeedback.self, forKey: .feedback)
    }

    init(
        ref: String,
        state: String,
        title: String,
        plan: AppPlannedWorkout? = nil,
        activity: ActivityDetail? = nil,
        feedback: WorkoutFeedback? = nil
    ) {
        self.ref = ref
        self.state = state
        self.title = title
        self.plan = plan
        self.activity = activity
        self.feedback = feedback
    }

    /// A done activity with no plan, as a workout (fixtures and previews).
    init(activity: ActivityDetail) {
        self.init(
            ref: Self.stravaRef(activity.activityId),
            state: "done",
            title: activity.header?.value?.name ?? "",
            activity: activity,
            feedback: activity.feedback
        )
    }
}
