import SwiftUI

extension View {
    /// One field of a form's keyboard order: binds it to the form's `@FocusState`, labels the return key ("Next", then
    /// the order's last key) and sends the return. `.submitScope()` keeps an outer `.onSubmit` from firing too.
    ///
    ///     KoboTextField("Email", text: $email).formField(.email, in: form)
    public func formField<Field: Hashable & Sendable>(_ field: Field, in form: FormFocus<Field>) -> some View {
        self
            .focused(form.focus, equals: field)
            .submitLabel(form.order.returnKey(for: field).submitLabel)
            .onSubmit { form.onReturn(field) }
            .submitScope()
    }

    /// Mirrors a focus the screen's state owns into the view's `@FocusState`, and reports each change back (a tap on a
    /// field, a return, a closed keyboard). The first value applies once the page has appeared, so the keyboard rises
    /// after the push. Put it on the form's root, once.
    ///
    ///     form.formFocus($focus, mirroring: state.focus) { send(.focusChanged($0)) }
    public func formFocus<Field: Hashable & Sendable>(
        _ focus: FocusState<Field?>.Binding,
        mirroring stateFocus: Field?,
        onChange: @escaping (Field?) -> Void
    ) -> some View {
        self
            .onAppear { focus.wrappedValue = stateFocus }
            .onChange(of: stateFocus) { _, field in focus.wrappedValue = field }
            .onChange(of: focus.wrappedValue) { _, field in onChange(field) }
    }
}

extension FormReturnKey {
    /// The platform label of the key.
    var submitLabel: SubmitLabel {
        switch self {
        case .next: .next
        case .done: .done
        case .continue: .continue
        case .go: .go
        }
    }
}
