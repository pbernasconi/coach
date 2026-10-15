import KoboComponents
import KoboTokens
import SwiftUI

// Kobo's text fields keep a private focus for their ring and link a screen's `@FocusState` through `focused(by:)`,
// so `formField` on them links that way instead of wrapping them in a second `.focused`.

extension KoboTextField {
    /// One field of a form's keyboard order, linked through the field's own focus.
    ///
    ///     KoboTextField("Email", text: $email).formField(.email, in: form)
    public func formField<Field: Hashable & Sendable>(_ field: Field, in form: FormFocus<Field>) -> some View {
        focused(by: form.focus, equals: field).formReturn(field, in: form)
    }
}

extension KoboSecureField {
    /// One field of a form's keyboard order, linked through the field's own focus.
    public func formField<Field: Hashable & Sendable>(_ field: Field, in form: FormFocus<Field>) -> some View {
        focused(by: form.focus, equals: field).formReturn(field, in: form)
    }
}
