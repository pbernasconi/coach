import Foundation

/// The pure rule of `.announceOnRisingEdge(_:)`: speak a message when it appears or changes to a new non-empty value,
/// stay quiet when it repeats, and speak it again after it was cleared.
nonisolated enum AnnouncementEdge {
    /// The text to speak for a change, or `nil`.
    static func announcement(old: String?, new: String?) -> String? {
        guard let new, !new.isEmpty, new != old else { return nil }
        return new
    }

    /// One appearance or change: the text to speak, and the message to compare the next change with. A cleared
    /// message resets that value, so the same message speaks again when it comes back.
    static func step(announced: String?, message: String?) -> Step {
        let visible = message?.isEmpty == false ? message : nil
        return Step(speak: announcement(old: announced, new: visible), announced: visible)
    }

    /// The outcome of one change.
    struct Step: Equatable {
        /// What VoiceOver speaks now, if anything.
        let speak: String?
        /// The message the next change is compared with.
        let announced: String?
    }
}
