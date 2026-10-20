import Foundation

/// The current rest on the wall clock and its Live Activity. The Workout ViewModel owns one and keeps the in-app
/// `RestTimer`; this keeps the Lock Screen and the Dynamic Island in step with it, and it with them: their +30s and Skip
/// change the rest while Lift is in the background, and the next tick here picks that up.
final class RestActivitySession {
    private let controller: any RestActivityController
    private let now: @Sendable () -> Date
    /// The current rest; nil while there is none.
    private(set) var rest: RestSnapshot?
    /// The rest shows as a Live Activity, so its buttons may change it outside the app.
    private var isShownOutside = false

    init(controller: any RestActivityController, now: @escaping @Sendable () -> Date) {
        self.controller = controller
        self.now = now
    }

    /// The Workout screen shows `sessionID`; the Lock Screen follows that workout from its first logged set, and leaving
    /// the screen keeps it there, with its rest, until the workout is finished. Returns a rest that Done on the Lock
    /// Screen started for a set other than `setID` (the set the in-app rest follows), which becomes this rest; nil when
    /// there is none.
    func follow(workout sessionID: UUID, restingAfter setID: UUID?) -> RestSnapshot? {
        controller.showWorkout(sessionID)
        guard let outside = controller.currentRest(), let outsideSet = outside.setID, outsideSet != setID,
            outside.secondsLeft(at: now()) > 0
        else { return nil }
        rest = outside
        isShownOutside = true
        return outside
    }

    /// A rest of `seconds` from now. Shows the Live Activity when the logged set is known.
    func start(seconds: Int, activity: RestActivityStart?) {
        let rest = RestSnapshot(endsAt: now().addingTimeInterval(TimeInterval(seconds)), totalSeconds: seconds)
        self.rest = rest
        isShownOutside = activity != nil
        guard let activity else { return }
        let state = RestActivityAttributes.ContentState(
            endsAt: rest.endsAt,
            totalSeconds: seconds,
            nextSetLabel: activity.nextSetLabel
        )
        controller.start(activity.attributes, state: state)
    }

    /// +30s: `seconds` more on the rest as it stands, including time added on the Lock Screen. Returns the longer rest,
    /// or nil when there is none left to extend.
    func extend(by seconds: Int) -> RestSnapshot? {
        guard let current = follow(), let next = current.extended(by: seconds, at: now()) else { return nil }
        rest = next
        controller.update(endsAt: next.endsAt, totalSeconds: next.totalSeconds)
        return next
    }

    /// The in-app countdown one second on, following the rest outside the app (`RestTimer.ticked(following:at:)`).
    /// Nil once the rest is over, or after a Skip on the Lock Screen.
    func tick(_ timer: RestTimer) -> RestTimer? {
        guard let rest = follow() else { return nil }
        return timer.ticked(following: rest, at: now())
    }

    /// Skip, zero or leaving: removes the Live Activity. Does nothing while there is no rest.
    func end() {
        guard rest != nil else { return }
        rest = nil
        controller.end()
    }

    /// The rest as it stands now: as the Live Activity's buttons left it when it shows outside the app. A Skip there
    /// ends it here as well.
    private func follow() -> RestSnapshot? {
        guard let rest else { return nil }
        guard isShownOutside else { return rest }
        guard let outside = controller.currentRest() else {
            end()
            return nil
        }
        self.rest = outside
        return outside
    }
}
