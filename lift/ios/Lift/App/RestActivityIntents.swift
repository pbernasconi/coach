import ActivityKit
import AppIntents
import Foundation

/// +30s on the rest Live Activity (Lock Screen and Dynamic Island). A `LiveActivityIntent`: the system runs it in Lift's
/// process in the background, without opening the app. It saves the longer rest to the App Group, where the Workout
/// screen follows it, and moves the Live Activity's end. Compiled into the app and LiftWidgets (whose buttons name it).
/// Like the composition root, a system entry point reads the wall clock itself.
nonisolated struct AddRestTimeIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Add 30 seconds to the rest"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        let rest = AppGroupRestSnapshotStore(bundle: .main).flatMap { RestButtonAction.extend($0, at: Date()) }
        if let rest {
            await RestActivityContent.move(to: rest)
        } else {
            await RestActivityContent.endAll()
        }
        return .result()
    }
}

/// Skip on the rest Live Activity: clears the shared rest, so the Workout screen ends its rest bar too, and removes the
/// Live Activity. Runs in the background like `AddRestTimeIntent`.
nonisolated struct SkipRestIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Skip the rest"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        if let store = AppGroupRestSnapshotStore(bundle: .main) {
            RestButtonAction.skip(store)
        }
        await RestActivityContent.endAll()
        return .result()
    }
}

/// The rest Live Activities as the buttons change them. `Activity` is not `Sendable`, so each one is looked up and
/// changed inside a `@concurrent` function and never crosses an isolation boundary. The system runs Live Activity
/// intents in the app's process, so the widget extension (`LIFT_EXTENSION`) compiles these as no-ops.
nonisolated enum RestActivityContent {
    /// Moves every running rest activity's end to `rest`'s; the system counts down to it.
    @concurrent
    static func move(to rest: RestSnapshot) async {
        #if !LIFT_EXTENSION
            for activity in Activity<RestActivityAttributes>.activities {
                var state = activity.content.state
                state.endsAt = rest.endsAt
                state.totalSeconds = rest.totalSeconds
                await activity.update(ActivityContent(state: state, staleDate: rest.endsAt))
            }
        #endif
    }

    /// Removes every rest activity at once.
    @concurrent
    static func endAll() async {
        #if !LIFT_EXTENSION
            for activity in Activity<RestActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        #endif
    }
}
