import SwiftUI

/// A form's keyboard wiring: the order of its text fields, the screen's `@FocusState`, and what the last return does.
/// Build it in a computed property and pass it to each field's `.formField(_:in:)`; the return key then says "Next"
/// and moves on, and the last field shows the order's last key.
///
///     nonisolated enum Field: Hashable, Sendable { case name, email }   // nonisolated in a MainActor target
///     @FocusState private var focus: Field?
///     private var form: FormFocus<Field> {
///         FormFocus(FormFocusOrder([.name, .email], last: .continue), focus: $focus, onSubmit: next)
///     }
///     KoboTextField("Name", text: $name).formField(.name, in: form)
///     KoboTextField("Email", text: $email).formField(.email, in: form)
///
/// A screen whose state owns the focus passes `onReturn` instead and moves the focus itself with
/// `FormFocusOrder.onReturn(from:focus:)`.
public struct FormFocus<Field: Hashable & Sendable> {
    let order: FormFocusOrder<Field>
    let focus: FocusState<Field?>.Binding
    let onReturn: (Field) -> Void

    /// Moves the focus by itself: "Next" focuses the next field, "Done" closes the keyboard, and "Continue" or "Go"
    /// runs `onSubmit`. A stale return (from a field that lost the focus) does nothing.
    public init(_ order: FormFocusOrder<Field>, focus: FocusState<Field?>.Binding, onSubmit: @escaping () -> Void) {
        self.order = order
        self.focus = focus
        self.onReturn = { field in
            switch order.onReturn(from: field, focus: focus.wrappedValue) {
            case .focus(let next): focus.wrappedValue = next
            case .dismiss: focus.wrappedValue = nil
            case .submit: onSubmit()
            case .ignore: break
            }
        }
    }

    /// Reports each return to the caller, which decides where the focus goes (a screen whose state owns the focus).
    public init(
        _ order: FormFocusOrder<Field>,
        focus: FocusState<Field?>.Binding,
        onReturn: @escaping (Field) -> Void
    ) {
        self.order = order
        self.focus = focus
        self.onReturn = onReturn
    }
}
