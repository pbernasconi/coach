import Foundation
import LiftSync
import UserNotifications

/// Reminders Paolo sets in the Coach chat ("remind me at 18:00 to do physio"; lift/APP-API.md, "Reminders"). The coach
/// keeps them (`GET /api/app/coach/reminders`); this schedules each one as a local notification, so it rings on time
/// with no network, and takes off a pending one the coach no longer has (Undo). It runs when Lift opens or comes back
/// and after a Coach card is applied or undone. Running it twice is harmless: a request with the same id replaces the
/// one before.
nonisolated struct CoachReminders: Sendable {
    /// Every reminder's notification id starts with this.
    static let prefix = "coach.reminder."

    let client: any AppAPIFetching
    var now: @Sendable () -> Date = { Date() }

    func sync() async {
        guard let data = try? await client.get("api/app/coach/reminders"),
            let wire = try? Self.decoder().decode(CoachReminderWire.self, from: data)
        else { return }
        let now = now()
        let due = wire.reminders.filter { $0.at > now }
        let center = UNUserNotificationCenter.current()
        let wanted = Set(due.map { Self.prefix + $0.id })
        let gone = await center.pendingNotificationRequests().map(\.identifier)
            .filter { $0.hasPrefix(Self.prefix) && !wanted.contains($0) }
        if !gone.isEmpty { center.removePendingNotificationRequests(withIdentifiers: gone) }
        guard !due.isEmpty, (try? await center.requestAuthorization(options: [.alert, .sound])) == true else { return }
        for reminder in due {
            let content = UNMutableNotificationContent()
            content.title = String(localized: "Coach")
            content.body = reminder.text
            content.sound = .default
            content.userInfo = ["link": "lift://coach", "type": "coach.reminder"]
            let seconds = max(1, reminder.at.timeIntervalSince(now))
            let request = UNNotificationRequest(
                identifier: Self.prefix + reminder.id,
                content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
            )
            try? await center.add(request)
        }
    }

    private static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}

/// `GET /api/app/coach/reminders`: `{ "reminders": [{ "id", "at": "2026-11-04T02:00:00Z", "text" }] }`.
nonisolated private struct CoachReminderWire: Decodable {
    struct Reminder: Decodable {
        let id: String
        let at: Date
        let text: String
    }

    let reminders: [Reminder]
}
