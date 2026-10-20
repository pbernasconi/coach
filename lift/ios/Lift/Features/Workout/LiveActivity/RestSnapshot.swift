import Foundation

/// The rest as it stands outside the app: the workout Live Activity shows it, its +30s and Skip change it while Lift is
/// in the background, and the Workout screen follows it when it comes back, so the in-app rest bar and the Lock Screen
/// agree. Compiled into the app and LiftWidgets.
nonisolated struct RestSnapshot: Codable, Hashable, Sendable {
    /// What one +30s adds, in the app and on the Lock Screen.
    static let extensionSeconds = 30

    /// When the rest is over.
    var endsAt: Date
    /// The whole rest in seconds, including time added with +30s.
    var totalSeconds: Int

    /// The rest with `seconds` more on it, or nil once it is over at `now` (there is nothing left to extend).
    func extended(by seconds: Int, at now: Date) -> RestSnapshot? {
        guard endsAt > now else { return nil }
        let added = max(0, seconds)
        return RestSnapshot(endsAt: endsAt.addingTimeInterval(TimeInterval(added)), totalSeconds: totalSeconds + added)
    }

    /// Whole seconds left at `now`, rounded up; 0 once the rest is over.
    func secondsLeft(at now: Date) -> Int {
        max(0, Int(endsAt.timeIntervalSince(now).rounded(.up)))
    }
}
