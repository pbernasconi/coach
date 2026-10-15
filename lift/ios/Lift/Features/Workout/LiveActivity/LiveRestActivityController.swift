import ActivityKit
import Foundation

/// The rest countdown as an ActivityKit Live Activity, updated from the app only (no push token).
final class LiveRestActivityController: RestActivityController {
    private var activity: Activity<RestActivityAttributes>?
    private var state: RestActivityAttributes.ContentState?

    func start(_ attributes: RestActivityAttributes, state: RestActivityAttributes.ContentState) {
        if let activity, activity.attributes == attributes {
            show(state, on: activity)
            return
        }
        end()
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        do {
            activity = try Activity.request(attributes: attributes, content: Self.content(state), pushType: nil)
            self.state = state
        } catch {
            AppLog.rest.error("Starting the rest Live Activity failed: \(String(describing: error), privacy: .private)")
        }
    }

    func update(endsAt: Date, totalSeconds: Int) {
        guard let activity, var state else { return }
        state.endsAt = endsAt
        state.totalSeconds = totalSeconds
        show(state, on: activity)
    }

    /// Ends this rest and any left over from an earlier launch. The list is read now, so a rest started right
    /// after this call is not ended by it.
    func end() {
        activity = nil
        state = nil
        let running = Activity<RestActivityAttributes>.activities
        guard !running.isEmpty else { return }
        Task {
            for activity in running {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    private func show(_ state: RestActivityAttributes.ContentState, on activity: Activity<RestActivityAttributes>) {
        self.state = state
        let content = Self.content(state)
        Task { await activity.update(content) }
    }

    /// The system marks the activity stale once the rest is over, in case the app is not running to end it.
    private static func content(
        _ state: RestActivityAttributes.ContentState
    ) -> ActivityContent<RestActivityAttributes.ContentState> {
        ActivityContent(state: state, staleDate: state.endsAt)
    }
}
