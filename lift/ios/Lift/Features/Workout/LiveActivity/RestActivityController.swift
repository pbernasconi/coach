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
}

/// Used when Live Activities are turned off for Lift: the rest shows in the app only.
final class DisabledRestActivityController: RestActivityController {
    func start(_: RestActivityAttributes, state _: RestActivityAttributes.ContentState) {}
    func update(endsAt _: Date, totalSeconds _: Int) {}
    func end() {}
}
