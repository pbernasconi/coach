import Foundation

/// The current rest's end on the wall clock and its Live Activity. The Workout ViewModel owns one and keeps the
/// in-app `RestTimer`; this keeps the Lock Screen and the Dynamic Island in step with it.
final class RestActivitySession {
    private let controller: any RestActivityController
    private let now: @Sendable () -> Date
    /// When the current rest is over; nil while there is none.
    private(set) var endsAt: Date?

    init(controller: any RestActivityController, now: @escaping @Sendable () -> Date) {
        self.controller = controller
        self.now = now
    }

    /// The owner went away (the workout was left): its rest ends outside the app too.
    isolated deinit {
        end()
    }

    /// A rest of `seconds` from now. Shows the Live Activity when the logged set is known.
    func start(seconds: Int, activity: RestActivityStart?) {
        let endsAt = now().addingTimeInterval(TimeInterval(seconds))
        self.endsAt = endsAt
        guard let activity else { return }
        let state = RestActivityAttributes.ContentState(
            endsAt: endsAt,
            totalSeconds: seconds,
            nextSetLabel: activity.nextSetLabel
        )
        controller.start(activity.attributes, state: state)
    }

    /// +30s: moves the end by `seconds`; `totalSeconds` is the whole rest now.
    func extend(by seconds: Int, totalSeconds: Int) {
        guard let current = endsAt else { return }
        let endsAt = current.addingTimeInterval(TimeInterval(seconds))
        self.endsAt = endsAt
        controller.update(endsAt: endsAt, totalSeconds: totalSeconds)
    }

    /// Skip, zero or leaving: removes the Live Activity. Does nothing while there is no rest.
    func end() {
        guard endsAt != nil else { return }
        endsAt = nil
        controller.end()
    }

    /// Whole seconds left on the wall clock, rounded up; 0 while there is no rest.
    var secondsLeft: Int {
        guard let endsAt else { return 0 }
        return Int(endsAt.timeIntervalSince(now()).rounded(.up))
    }
}
