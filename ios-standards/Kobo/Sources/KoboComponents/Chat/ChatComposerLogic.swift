import Foundation

/// The rules of a chat composer: its shape, and what its round buttons do and whether they are enabled.
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

    /// The one round button inside the single-line capsule.
    enum CompactButton: Equatable, Sendable {
        case send
        case stop
        case microphone
        case none
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

    /// The composer opens into a card with a toolbar while the field has focus, the microphone listens or something is
    /// attached (the thumbnails sit above the field); otherwise it is a single-line capsule.
    static func isExpanded(isFocused: Bool, isListening: Bool, hasAttachments: Bool = false) -> Bool {
        isFocused || isListening || hasAttachments
    }

    /// The capsule's button: stop while a reply can be stopped, send with a draft, else the microphone when there is
    /// one, else none (never a disabled circle).
    static func compactButton(
        draft: String,
        attachments: Attachments = .none,
        isResponding: Bool,
        canStop: Bool,
        hasVoice: Bool
    ) -> CompactButton {
        switch button(draft: draft, attachments: attachments, isResponding: isResponding, canStop: canStop) {
        case .stop: .stop
        case .send(isEnabled: true): .send
        case .send(isEnabled: false), .waiting: hasVoice && !isResponding ? .microphone : .none
        }
    }
}
