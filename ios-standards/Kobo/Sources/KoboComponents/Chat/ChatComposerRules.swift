import Foundation

/// What the composer's trailing button does now. Pure, so tests check it without a keyboard.
nonisolated enum ChatComposerAction: Equatable, Sendable {
    /// Nothing typed: the send button shows, disabled.
    case none
    /// Text to send.
    case send
    /// A reply is arriving: the button stops it.
    case stop

    /// The action for the typed `text` while a reply is (or is not) arriving. Stop wins, so a reader can always cut a
    /// long reply short; whitespace alone is nothing to send.
    static func current(text: String, isResponding: Bool) -> ChatComposerAction {
        if isResponding { return .stop }
        return text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .none : .send
    }
}
