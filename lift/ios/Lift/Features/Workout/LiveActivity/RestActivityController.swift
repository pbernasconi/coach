import Foundation

/// Shows the rest countdown outside the app (Lock Screen, Dynamic Island). The Workout ViewModel drives it; the
/// composition root picks the live ActivityKit one, and tests pass a recording fake (SCR-3).
protocol RestActivityController: AnyObject {
    /// Shows a new rest, or updates the one on screen when it is for the same exercise and set.
    func start(_ attributes: RestActivityAttributes, state: RestActivityAttributes.ContentState)
    /// Moves the end of the rest on screen, after +30s.
    func update(endsAt: Date, totalSeconds: Int)
    /// Removes the rest from the Lock Screen and the Dynamic Island at once.
    func end()
    /// The rest as it stands outside the app: the Live Activity's +30s and Skip change it while Lift is in the
    /// background. Nil when there is none (it was skipped there, or ended).
    func currentRest() -> RestSnapshot?
}

/// Used when Live Activities are turned off for Lift: the rest shows in the app only, so only the app changes it.
final class DisabledRestActivityController: RestActivityController {
    private var rest: RestSnapshot?

    func start(_: RestActivityAttributes, state: RestActivityAttributes.ContentState) {
        rest = RestSnapshot(endsAt: state.endsAt, totalSeconds: state.totalSeconds)
    }

    func update(endsAt: Date, totalSeconds: Int) {
        rest = RestSnapshot(endsAt: endsAt, totalSeconds: totalSeconds)
    }

    func end() {
        rest = nil
    }

    func currentRest() -> RestSnapshot? {
        rest
    }
}
