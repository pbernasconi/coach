import UIKit
import UserNotifications

/// The UIKit callbacks SwiftUI has no scene API for: the APNs token and the notification center (lift/PUSH.md). It
/// holds no rule: the token and a tapped notice go to `PushInbox`, which the shell attaches to.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    /// What arrived before the shell attached, and the way to it after.
    let push = PushInbox()

    /// Sets the notification center's delegate before launch ends, or a tap that launched the app is never delivered.
    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    func application(_: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        push.tokenReceived(ApnsToken.hex(deviceToken))
    }

    /// No token (a simulator without APNs, a build without the push entitlement): no pushes, and nothing to show.
    func application(_: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: any Error) {
        AppLog.push.info("No APNs token: \(String(describing: error), privacy: .private)")
    }

    /// A notice that comes while Lift is open shows as a banner too.
    nonisolated func userNotificationCenter(
        _: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // "Rest over" is for a phone in a pocket; with Lift open the dock already says it.
        let isRest = notification.request.identifier == LocalRestAlerts.identifier
        completionHandler(isRest ? [] : [.banner, .list, .sound])
    }

    nonisolated func userNotificationCenter(
        _: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let tap = PushTap(userInfo: response.notification.request.content.userInfo)
        completionHandler()
        Task { @MainActor in self.push.tapped(tap) }
    }
}
