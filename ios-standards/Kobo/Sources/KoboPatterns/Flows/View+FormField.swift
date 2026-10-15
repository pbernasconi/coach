import SwiftUI

extension View {
    /// One field of a form's keyboard order: binds it to the form's `@FocusState`, labels the return key ("Next", then
    /// the order's last key) and sends the return. `.submitScope()` keeps an outer `.onSubmit` from firing too.
    ///
    ///     KoboTextField("Email", text: $email).formField(.email, in: form)
    public func formField<Field: Hashable & Sendable>(_ field: Field, in form: FormFocus<Field>) -> some View {
        focused(form.focus, equals: field).formReturn(field, in: form)
    }

    /// The return half of `formField`: the key's label, the return sent to the form, and a scoped `onSubmit`.
    func formReturn<Field: Hashable & Sendable>(_ field: Field, in form: FormFocus<Field>) -> some View {
        self
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

#if DEBUG
    private struct FormFieldPreview: View {
        nonisolated enum Field: Hashable, Sendable { case name, email, note }

        @FocusState private var focus: Field?
        @State private var name = ""
        @State private var email = ""
        @State private var note = ""
        @State private var submitted = 0

        private var form: FormFocus<Field> {
            FormFocus(FormFocusOrder([.name, .email, .note], last: .continue), focus: $focus) { submitted += 1 }
        }

        var body: some View {
            Form {
                TextField("Name", text: $name).formField(.name, in: form)
                TextField("Email", text: $email).formField(.email, in: form)
                TextField("Note", text: $note).formField(.note, in: form)
                Text(verbatim: "Submitted \(submitted) times")
            }
            .onAppear { focus = form.order.initialFocus }
        }
    }

    #Preview("Light") { FormFieldPreview() }
    #Preview("Dark") { FormFieldPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { FormFieldPreview().dynamicTypeSize(.accessibility3) }
#endif
