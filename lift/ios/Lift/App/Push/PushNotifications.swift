import Foundation
import LiftSync

/// Lift's push notifications for the person's own log (lift/PUSH.md): the registrar that keeps this install's token
/// with the coach, and the report of a tapped notice. The shell routes the tap's link (`AppLink`).
final class PushNotifications {
    let registrar: PushRegistrar
    private let devices: any PushDeviceRegistering

    init(registrar: PushRegistrar, devices: any PushDeviceRegistering) {
        self.registrar = registrar
        self.devices = devices
    }

    /// Tells the coach a notice was opened. Fire and forget: the person sees nothing either way.
    func tapped(_ tap: PushTap) {
        guard let id = tap.notificationID else { return }
        Task { [devices] in try? await devices.opened(notificationID: id) }
    }
}
