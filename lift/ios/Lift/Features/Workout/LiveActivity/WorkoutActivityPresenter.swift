import ActivityKit
import Foundation

/// Puts the workout Live Activity on screen, changes it and removes it. `WorkoutActivityCenter` decides what it shows;
/// tests pass a recording fake.
protocol WorkoutActivityPresenting: AnyObject {
    /// The workout Live Activity left running, if any (after a relaunch, or when a button launched Lift).
    func running() -> (attributes: WorkoutActivityAttributes, state: WorkoutActivityAttributes.ContentState)?
    /// Shows `state` on the Live Activity for `attributes`' workout, starting it when none runs. Another workout's
    /// activity is ended first.
    func show(_ attributes: WorkoutActivityAttributes, state: WorkoutActivityAttributes.ContentState) async
    /// Removes every workout Live Activity at once.
    func end() async
}

/// The workout as an ActivityKit Live Activity, updated from the app (no push token). The system counts the rest down
/// on its own and marks the content stale when the rest is over, so the Lock Screen shows "Rest over" without Lift.
///
/// `Activity` is not `Sendable`, so updates and ends look the activity up again inside `@concurrent` helpers, where it
/// never crosses an isolation boundary.
final class LiveWorkoutActivityPresenter: WorkoutActivityPresenting {
    func running() -> (attributes: WorkoutActivityAttributes, state: WorkoutActivityAttributes.ContentState)? {
        Activity<WorkoutActivityAttributes>.activities.first.map { ($0.attributes, $0.content.state) }
    }

    func show(_ attributes: WorkoutActivityAttributes, state: WorkoutActivityAttributes.ContentState) async {
        let content = ActivityContent(state: state, staleDate: state.rest?.endsAt)
        let running = Activity<WorkoutActivityAttributes>.activities
        if let id = running.first(where: { $0.attributes.sessionID == attributes.sessionID })?.id {
            await Self.update(id: id, content: content)
            return
        }
        if !running.isEmpty { await Self.endAll() }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        do {
            _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
        } catch {
            AppLog.rest.error(
                "Starting the workout Live Activity failed: \(String(describing: error), privacy: .private)"
            )
        }
    }

    func end() async {
        await Self.endAll()
    }

    @concurrent
    private static func update(id: String, content: ActivityContent<WorkoutActivityAttributes.ContentState>) async {
        guard let activity = Activity<WorkoutActivityAttributes>.activities.first(where: { $0.id == id }) else {
            return
        }
        await activity.update(content)
    }

    @concurrent
    private static func endAll() async {
        for activity in Activity<WorkoutActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
