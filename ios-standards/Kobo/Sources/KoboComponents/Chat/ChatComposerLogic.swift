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

    /// The draft with the outer spaces and line breaks removed; what is sent.
    static func message(from draft: String) -> String {
        draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Whether the draft holds something to send.
    static func canSend(_ draft: String) -> Bool { !message(from: draft).isEmpty }

    /// The send button for this draft, while a reply is or is not in progress.
    static func button(draft: String, isResponding: Bool, canStop: Bool) -> Button {
        if isResponding { return canStop ? .stop : .waiting }
        return .send(isEnabled: canSend(draft))
    }

    /// The composer opens into a card with a toolbar while the field has focus or the microphone listens; otherwise
    /// it is a single-line capsule.
    static func isExpanded(isFocused: Bool, isListening: Bool) -> Bool { isFocused || isListening }

    /// The capsule's button: stop while a reply can be stopped, send with a draft, else the microphone when there is
    /// one, else none (never a disabled circle).
    static func compactButton(draft: String, isResponding: Bool, canStop: Bool, hasVoice: Bool) -> CompactButton {
        switch button(draft: draft, isResponding: isResponding, canStop: canStop) {
        case .stop: .stop
        case .send(isEnabled: true): .send
        case .send(isEnabled: false), .waiting: hasVoice && !isResponding ? .microphone : .none
        }
    }
}
