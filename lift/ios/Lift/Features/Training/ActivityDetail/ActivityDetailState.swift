import Foundation
import KoboPatterns
import LiftSync

/// The analysis charts' shared x axis.
nonisolated enum AnalysisAxis: String, CaseIterable, Equatable, Sendable {
    case distance, time
}

/// A page under the activity page, opened from a summary card or a "See all" row: the full charts and tables.
nonisolated enum ActivityPanel: String, Hashable, Identifiable, Sendable {
    /// Every stream on one axis, with the Distance | Time picker.
    case charts
    /// Pace or speed: the bars, the distribution and the splits.
    case pace
    case heartRate
    case power
    case splits
    case laps
    case bestEfforts
    case segments
    case sameRoute
    /// Every stat not in the grid.
    case stats

    var id: String { rawValue }
}

/// A write on the planned workout: none, one running, or one that failed (its words).
nonisolated enum PlanWrite: Equatable, Sendable {
    case idle
    case starting
    case saving
    case failed(String)

    var isRunning: Bool { self == .starting || self == .saving }

    /// The failed write's message.
    var failure: String? {
        if case .failed(let message) = self { message } else { nil }
    }
}

/// Everything the workout page renders: one workout, planned and done as one (`WorkoutDetail`). Exclusive states are
/// enums (SCR-6).
nonisolated struct ActivityDetailState: Equatable, Sendable {
    /// What is shown over the page.
    enum Destination: Equatable, Sendable {
        /// A page of full charts or tables.
        case panel(ActivityPanel)
        /// The day picker of "Move to another day".
        case moveDay(WorkoutMoveDay)
        /// "Delete workout?"
        case confirmDelete
    }

    /// The open panel, if one is open.
    var panel: ActivityPanel? {
        if case .panel(let panel) = destination { panel } else { nil }
    }

    /// The open day picker, if one is open.
    var moveDay: WorkoutMoveDay? {
        if case .moveDay(let move) = destination { move } else { nil }
    }

    var isConfirmingDelete: Bool { destination == .confirmDelete }

    /// The workout the page was opened with: `plan-<id>` or `strava-<id>` (also `strava-latest`).
    var ref: String
    /// What the list knew, for the first frame; nil when the page opened from a link or the plan.
    var seed: ActivitySeed?
    var workout = AppResourceState<WorkoutDetail>()
    var axis: AnalysisAxis = .distance
    /// The pace bars' mode key (`splits`, `laps`, `smoothed`); the first the server sends when `nil`.
    var paceMode: String?
    var destination: Destination?
    var feedback = WorkoutFeedbackEdit()
    /// "Start workout" and "Mark done" on a planned workout.
    var planWrite = PlanWrite.idle

    init(ref: String, seed: ActivitySeed? = nil, detail: AppResourceState<ActivityDetail>? = nil) {
        self.ref = ref
        self.seed = seed
        if let detail { self.detail = detail }
    }

    /// The done half as the activity views read it; `.empty` while there is none (a workout still to do).
    var detail: AppResourceState<ActivityDetail> {
        get {
            let content: KoboPatterns.Loadable<ActivityDetail> =
                switch workout.content {
                case .loading: .loading
                case .empty: .empty
                case .failed(let message, let retryLabel): .failed(message: message, retryLabel: retryLabel)
                case .loaded(let w): w.activity.map { .loaded($0) } ?? .empty
                }
            return AppResourceState(content: content, freshness: workout.freshness, needsReconnect: workout.needsReconnect)
        }
        set {
            workout = AppResourceState(
                content: newValue.content.map { WorkoutDetail(activity: $0) },
                freshness: newValue.freshness,
                needsReconnect: newValue.needsReconnect
            )
        }
    }

    /// The planned half: what the coach planned, nil for a workout done without a plan.
    var plan: AppPlannedWorkout? { workout.content.value?.plan }

    /// A planned workout not done yet: the bar's "…" offers moving it to another day and deleting it.
    var canChangePlan: Bool {
        guard let w = workout.content.value, let plan = w.plan else { return false }
        return w.activity == nil && plan.state != "done"
    }

    /// A planned workout with no Lift session or activity behind it: the bar's "…" offers Mark done, or Not done once
    /// it was marked by hand.
    var canToggleDone: Bool {
        guard let w = workout.content.value, let plan = w.plan else { return false }
        return w.activity == nil && plan.liftSessionId == nil && plan.done?.activityId == nil
    }

    /// Loaded, and planned but not done yet: the page shows the plan.
    var isPlanOnly: Bool {
        guard let w = workout.content.value else { return false }
        return w.activity == nil && w.plan != nil
    }

    /// The card's feedback: the edited copy, else the body's.
    var shownFeedback: WorkoutFeedback? {
        feedback.shown(workout.content.value?.feedback)
    }
}

/// The day picker of "Move to another day": the workout's day, and the days it can go to (the Week tab's weeks).
nonisolated struct WorkoutMoveDay: Equatable, Sendable, Identifiable {
    /// The plan activity id.
    let id: String
    let title: String
    /// "Friday, October 23": the sheet's subtitle.
    let dayTitle: String
    let current: Date
    let today: Date
    let first: Date
    let last: Date
}
