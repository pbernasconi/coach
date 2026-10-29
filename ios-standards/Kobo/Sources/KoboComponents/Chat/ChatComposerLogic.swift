import Foundation

/// The rules of a chat composer: its shape, and what its send button does and whether it is enabled. The send button
/// always shows: grey while there is nothing to send, the accent once there is, a stop square while a reply runs.
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

    /// Where the photos and files on the message stand.
    enum Attachments: Equatable, Sendable {
        /// Nothing attached: the draft alone decides.
        case none
        /// All uploaded: the message can go, even without words.
        case ready
        /// Some still uploading (or failed): Send waits.
        case pending
    }

    /// The draft with the outer spaces and line breaks removed; what is sent.
    static func message(from draft: String) -> String {
        draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Whether the message can go: words, or attachments that are all uploaded, and none still on its way.
    static func canSend(_ draft: String, attachments: Attachments = .none) -> Bool {
        switch attachments {
        case .none: !message(from: draft).isEmpty
        case .ready: true
        case .pending: false
        }
    }

    /// The send button for this draft, while a reply is or is not in progress.
    static func button(draft: String, attachments: Attachments = .none, isResponding: Bool, canStop: Bool) -> Button {
        if isResponding { return canStop ? .stop : .waiting }
        return .send(isEnabled: canSend(draft, attachments: attachments))
    }

    /// The composer opens into a card with a toolbar once there is a draft, while the microphone listens, or while
    /// something is attached (the thumbnails sit above the field); empty, it is a single-line capsule.
    static func isExpanded(draft: String, isListening: Bool, hasAttachments: Bool = false) -> Bool {
        !draft.isEmpty || isListening || hasAttachments
    }
}
