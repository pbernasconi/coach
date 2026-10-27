import Foundation

/// Whether the Coach tab's conversation is on screen. The Coach screen sets it; the notification delegate reads it so
/// a Coach reply shows no banner over the conversation it is already in (lift/PUSH.md).
@MainActor
final class CoachPresence {
    var isShown = false

    init() {}

    /// The push type of a Coach reply (lift/PUSH.md).
    nonisolated static let replyType = "coach.replied"

    /// Whether a notice that arrives while Coach is open shows a banner: not a Coach reply while the conversation shows.
    nonisolated static func showsBanner(type: String?, coachShown: Bool) -> Bool {
        !(coachShown && type == replyType)
    }
}

/// Opens this app's page in iOS Settings, where the microphone and speech recognition are turned on.
@MainActor
protocol AppSettingsOpening: AnyObject {
    func openAppSettings()
}
