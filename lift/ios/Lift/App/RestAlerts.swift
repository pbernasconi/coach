import Foundation
import UserNotifications

/// Tells the person a rest is over when the phone is in their pocket: a local notification at the rest's end, when
/// Workout settings say Alert. `WorkoutActivityCenter` reports every change to the rest, from the app and from the Lock
/// Screen's buttons; tests pass `NoRestAlerts`.
protocol RestAlerting: AnyObject {
    /// The rest now ends at `endsAt`, before `nextSet` ("Back squat · Set 2"); nil when there is no rest. Replaces any
    /// alert scheduled before.
    func restChanged(endsAt: Date?, nextSet: String?)
}

/// No alerts: tests, previews, and data that never leaves the app.
final class NoRestAlerts: RestAlerting {
    func restChanged(endsAt _: Date?, nextSet _: String?) {}
}

/// `RestAlerting` over `UNUserNotificationCenter`. The first alert asks for permission; a refusal means no alerts, and
/// the in-app haptic still plays. While Lift is open the notification is not shown (`AppDelegate`): the dock says it.
final class LocalRestAlerts: RestAlerting {
    /// The one pending rest alert; a new rest replaces it.
    nonisolated static let identifier = "lift.rest.over"

    private let center: UNUserNotificationCenter
    private let preferences: any WorkoutPreferenceStore
    private let now: @Sendable () -> Date
    /// The end the pending alert is for, so a publish that did not move the rest leaves it alone.
    private var scheduledEnd: Date?

    init(center: UNUserNotificationCenter, preferences: any WorkoutPreferenceStore, now: @escaping @Sendable () -> Date) {
        self.center = center
        self.preferences = preferences
        self.now = now
    }

    func restChanged(endsAt: Date?, nextSet: String?) {
        let wanted = preferences.preferences.restAlert == .alert ? endsAt : nil
        guard wanted != scheduledEnd else { return }
        scheduledEnd = wanted
        center.removePendingNotificationRequests(withIdentifiers: [Self.identifier])
        guard let wanted else { return }
        let seconds = wanted.timeIntervalSince(now())
        guard seconds >= 1 else { return }
        let content = UNMutableNotificationContent()
        content.title = String(localized: "Rest over")
        content.body = nextSet.map { String(localized: "Next: \($0)") } ?? ""
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: Self.identifier,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        )
        let center = center
        Task {
            guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true else { return }
            try? await center.add(request)
        }
    }
}
