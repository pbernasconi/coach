import ActivityKit
import Foundation

/// The rest countdown as an ActivityKit Live Activity, updated from the app (no push token) and by its own +30s and Skip
/// buttons (`AddRestTimeIntent`, `SkipRestIntent`), which change the rest saved in `store`.
///
/// `Activity` is not `Sendable`, so the controller keeps only the activity's id and attributes. Updates and ends
/// look the activity up again inside `@concurrent` helpers, where it never crosses an isolation boundary.
final class LiveRestActivityController: RestActivityController {
    /// The rest shared with the buttons, in the App Group; nil when the build names no App Group.
    private let store: (any RestSnapshotStoring)?
    /// The rest when there is no store.
    private var rest: RestSnapshot?
    private var activityID: String?
    private var attributes: RestActivityAttributes?
    private var state: RestActivityAttributes.ContentState?

    init(store: (any RestSnapshotStoring)?) {
        self.store = store
    }

    func start(_ attributes: RestActivityAttributes, state: RestActivityAttributes.ContentState) {
        if let activityID, self.attributes == attributes {
            remember(state)
            show(state, on: activityID)
            return
        }
        end()
        remember(state)
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
        remember(RestSnapshot(endsAt: endsAt, totalSeconds: totalSeconds))
        guard let activityID, var state else { return }
        state.endsAt = endsAt
        state.totalSeconds = totalSeconds
        show(state, on: activityID)
    }

    /// Ends this rest and any left over from an earlier launch. The ids are read now, so a rest started right after
    /// this call is not ended by it.
    func end() {
        remember(nil)
        activityID = nil
        attributes = nil
        state = nil
        let running = Activity<RestActivityAttributes>.activities.map(\.id)
        guard !running.isEmpty else { return }
        Task { await Self.end(ids: running) }
    }

    func currentRest() -> RestSnapshot? {
        guard let store else { return rest }
        return store.load()
    }

    private func remember(_ state: RestActivityAttributes.ContentState) {
        remember(RestSnapshot(endsAt: state.endsAt, totalSeconds: state.totalSeconds))
    }

    private func remember(_ rest: RestSnapshot?) {
        self.rest = rest
        store?.save(rest)
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
    private static func end(ids: [String]) async {
        for activity in Activity<RestActivityAttributes>.activities where ids.contains(activity.id) {
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
