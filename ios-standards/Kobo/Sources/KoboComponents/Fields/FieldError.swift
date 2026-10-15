import Foundation

/// How a field shows a validation failure. Fields show it only after the user leaves the field or submits
/// (`FieldErrorGate`), never while they type the first characters.
///
///     KoboTextField("Email", text: $email, error: emailIsValid ? .none : .message("Enter a valid email"))
nonisolated public enum FieldError: Hashable, Sendable {
    /// No error.
    case none
    /// The danger border only: the message is shown somewhere else (a banner, a group's footer).
    case highlight
    /// The danger border and a message with an alert glyph under the field.
    case message(String)

    /// True for `.highlight` and `.message`.
    public var isError: Bool { self != .none }

    /// The message to show, or `nil` for `.none`, `.highlight` and an empty message.
    public var message: String? {
        guard case .message(let text) = self, !text.isEmpty else { return nil }
        return text
    }
}

/// When a field shows its error: on blur or on submit, never while the user types the first characters.
/// An error that appears in the same update as an edit, while the field has focus, waits for the blur. An error that
/// appears with no edit (a submit, a server reply) shows at once. A cleared error resets the gate.
nonisolated enum FieldErrorGate {
    /// What the gate reads from one render of the field.
    struct Reading: Equatable, Sendable {
        /// The field text, or `nil` when the field does not report it (every error then shows at once).
        let value: String?
        let hasError: Bool
        let focused: Bool
    }

    /// Whether the gate holds the error back after the change from `old` to `new`.
    static func suppressed(_ suppressed: Bool, old: Reading, new: Reading) -> Bool {
        if !new.hasError || !new.focused { return false }
        let edited = new.value != nil && old.value != new.value
        if !old.hasError && edited { return true }
        return suppressed
    }

    /// Whether the field draws the error: a held-back error shows as soon as the field loses focus.
    static func visible(hasError: Bool, suppressed: Bool, focused: Bool) -> Bool {
        hasError && !(suppressed && focused)
    }
}

/// What the line under a field box shows: the error message, else the helper text, else nothing. One line, never two.
nonisolated enum FieldLineContent: Hashable, Sendable {
    case none
    case helper
    case error(String)

    init(hasHelper: Bool, error: FieldError) {
        if let message = error.message {
            self = .error(message)
        } else if hasHelper && error != .highlight {
            self = .helper
        } else {
            self = .none
        }
    }
}

/// When the clear button of a text field shows: the field opts in, it is enabled, and it has text.
nonisolated enum InputClear {
    static func shows(clearable: Bool, text: String, isEnabled: Bool) -> Bool {
        clearable && isEnabled && !text.isEmpty
    }
}
