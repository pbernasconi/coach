import ActivityKit
import Foundation

/// The rest countdown as an ActivityKit Live Activity, updated from the app only (no push token).
///
/// `Activity` is not `Sendable`, so the controller keeps only the activity's id and attributes. Updates and ends
/// look the activity up again inside `@concurrent` helpers, where it never crosses an isolation boundary.
final class LiveRestActivityController: RestActivityController {
    private var activityID: String?
    private var attributes: RestActivityAttributes?
    private var state: RestActivityAttributes.ContentState?

    func start(_ attributes: RestActivityAttributes, state: RestActivityAttributes.ContentState) {
        if let activityID, self.attributes == attributes {
            show(state, on: activityID)
            return
        }
        end()
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        do {
            let activity = try Activity.request(attributes: attributes, content: Self.content(state), pushType: nil)
            activityID = activity.id
            self.attributes = attributes
            self.state = state
        } catch {
            AppLog.rest.error("Starting the rest Live Activity failed: \(String(describing: error), privacy: .private)")
        }
    }

    func update(endsAt: Date, totalSeconds: Int) {
        guard let activityID, var state else { return }
        state.endsAt = endsAt
        state.totalSeconds = totalSeconds
        show(state, on: activityID)
    }

    /// Ends this rest and any left over from an earlier launch.
    func end() {
        activityID = nil
        attributes = nil
        state = nil
        Task { await Self.endAll() }
    }

    private func show(_ state: RestActivityAttributes.ContentState, on id: String) {
        self.state = state
        let content = Self.content(state)
        Task { await Self.update(id: id, content: content) }
    }

    @concurrent
    private static func update(id: String, content: ActivityContent<RestActivityAttributes.ContentState>) async {
        guard let activity = Activity<RestActivityAttributes>.activities.first(where: { $0.id == id }) else { return }
        await activity.update(content)
    }

    @concurrent
    private static func endAll() async {
        for activity in Activity<RestActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    /// The system marks the activity stale once the rest is over, in case the app is not running to end it.
    private static func content(
        _ state: RestActivityAttributes.ContentState
    ) -> ActivityContent<RestActivityAttributes.ContentState> {
        ActivityContent(state: state, staleDate: state.endsAt)
    }
}
