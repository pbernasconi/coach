import Foundation

/// The keyboard order of a form: the return key of a field with a field after it says "Next" and moves there, and the
/// last field shows `last`. Build the order from the fields the form shows now, so a hidden field is never a stop.
/// Only fields that take text belong in it, never a picker or a sheet row.
///
///     let order = FormFocusOrder<Field>([.name, .email, .note], last: .continue)
///     order.returnKey(for: .email)                    // .next
///     order.onReturn(from: .note, focus: .note)       // .submit
nonisolated public struct FormFocusOrder<Field: Hashable & Sendable>: Equatable, Sendable {
    public let fields: [Field]
    public let last: FormLastKey

    /// A repeated field is kept once, where it first shows: a second stop would send the return key back to it.
    public init(_ fields: [Field], last: FormLastKey = .done) {
        self.fields = fields.reduce(into: []) { unique, field in
            if !unique.contains(field) { unique.append(field) }
        }
        self.last = last
    }

    /// The field a form focuses when it first opens: the first one.
    public var initialFocus: Field? { fields.first }

    /// The field after `field`; `nil` for the last field and for a field that is not in the order.
    public func next(after field: Field) -> Field? {
        guard let index = fields.firstIndex(of: field), index + 1 < fields.count else { return nil }
        return fields[index + 1]
    }

    /// The field before `field`; `nil` for the first field and for a field that is not in the order.
    public func previous(before field: Field) -> Field? {
        guard let index = fields.firstIndex(of: field), index > 0 else { return nil }
        return fields[index - 1]
    }

    /// The label of the return key. A field that is not in the order closes the keyboard, so it says "Done".
    public func returnKey(for field: Field) -> FormReturnKey {
        guard fields.contains(field) else { return .done }
        return next(after: field) == nil ? last.returnKey : .next
    }

    /// What a return on `field` does: what `returnKey` says, or `.ignore` when `field` is not the focused field.
    public func onReturn(from field: Field, focus: Field?) -> FormReturn<Field> {
        guard field == focus else { return .ignore }
        switch returnKey(for: field) {
        case .next: return next(after: field).map(FormReturn.focus) ?? .dismiss
        case .done: return .dismiss
        case .continue, .go: return .submit
        }
    }
}
