import Foundation

/// The rules of a chat composer: what the trailing button does and whether it is enabled.
nonisolated enum ChatComposerLogic {
    /// The trailing button of the composer.
    enum Button: Equatable, Sendable {
        /// Send the draft; disabled when the draft is blank.
        case send(isEnabled: Bool)
        /// Stop the reply in progress.
        case stop
        /// A reply is in progress and cannot be stopped: a disabled send button.
        case waiting
    }

    /// The draft with the outer spaces and line breaks removed; what is sent.
    static func message(from draft: String) -> String {
        draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Whether the draft holds something to send.
    static func canSend(_ draft: String) -> Bool { !message(from: draft).isEmpty }

    /// The button for this draft, while a reply is or is not in progress.
    static func button(draft: String, isResponding: Bool, canStop: Bool) -> Button {
        if isResponding { return canStop ? .stop : .waiting }
        return .send(isEnabled: canSend(draft))
    }
}
