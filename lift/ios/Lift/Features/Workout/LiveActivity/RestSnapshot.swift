import Foundation

/// The rest as it stands outside the app. The app saves it when a rest starts, is extended or ends; the Live
/// Activity's +30s and Skip (`AddRestTimeIntent`, `SkipRestIntent`) change it while Lift is in the background; and the
/// Workout screen follows it when it comes back, so the in-app rest bar and the Lock Screen agree. Compiled into the app
/// and LiftWidgets.
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

/// What the Live Activity's buttons do to the shared rest. The intents call these, then show the result on the Live
/// Activity; keeping the rule here means the buttons and the app share it (PLAT-2).
nonisolated enum RestButtonAction {
    /// +30s: saves and returns the longer rest, or clears the rest and returns nil when there is none to extend (none
    /// was saved, or it is already over).
    static func extend(_ store: any RestSnapshotStoring, at now: Date) -> RestSnapshot? {
        let next = store.load()?.extended(by: RestSnapshot.extensionSeconds, at: now)
        store.save(next)
        return next
    }

    /// Skip: the rest is over now.
    static func skip(_ store: any RestSnapshotStoring) {
        store.save(nil)
    }
}
