import Foundation

/// The return key of a form field. `View.formField(_:in:)` maps it to the platform's `SubmitLabel`.
nonisolated public enum FormReturnKey: Equatable, Sendable, CaseIterable {
    /// Moves to the next field.
    case next
    /// Closes the keyboard.
    case done
    /// Runs the step's own button ("Continue").
    case `continue`
    /// Runs the form's own button, such as "Sign in".
    case go
}

/// The return key of the last field of a form. A step whose button commits something people cannot take back uses
/// `.done`, so the keyboard never submits it; a step before a review may use `.continue`.
nonisolated public enum FormLastKey: Equatable, Sendable, CaseIterable {
    /// Closes the keyboard; the person taps the button.
    case done
    /// Runs the step's own button.
    case `continue`
    /// Runs the form's own button.
    case go

    var returnKey: FormReturnKey {
        switch self {
        case .done: .done
        case .continue: .continue
        case .go: .go
        }
    }
}

/// What a return on a field does.
nonisolated public enum FormReturn<Field: Hashable & Sendable>: Equatable, Sendable {
    /// Focus moves to this field.
    case focus(Field)
    /// The keyboard closes.
    case dismiss
    /// The form runs its own button, as a tap on it does.
    case submit
    /// Nothing: the field no longer has the focus, so the return is stale (a repeated Enter after the step moved on).
    case ignore
}
