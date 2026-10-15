import SwiftUI

/// A caller's `@FocusState`, linked to the private focus of a Kobo field. The field keeps its own focus for its ring
/// and mirrors it both ways, so a screen can move focus between fields and read which one is active.
struct FieldFocusLink {
    let isFocused: () -> Bool
    let setFocused: (Bool) -> Void

    /// A `Bool` focus: `@FocusState var isFocused: Bool`.
    static func bool(_ binding: FocusState<Bool>.Binding) -> FieldFocusLink {
        FieldFocusLink(isFocused: { binding.wrappedValue }, setFocused: { binding.wrappedValue = $0 })
    }

    /// One case of an optional focus enum: `@FocusState var focus: Field?`.
    static func value<Value: Hashable>(_ binding: FocusState<Value?>.Binding, equals value: Value) -> FieldFocusLink {
        FieldFocusLink(
            isFocused: { binding.wrappedValue == value },
            setFocused: { focused in
                if focused {
                    binding.wrappedValue = value
                } else if binding.wrappedValue == value {
                    binding.wrappedValue = nil
                }
            }
        )
    }
}

extension View {
    /// Mirrors `isFocused` and the caller's link both ways. A `nil` link leaves the field's focus alone.
    func fieldFocusSync(_ link: FieldFocusLink?, isFocused: FocusState<Bool>.Binding) -> some View {
        modifier(FieldFocusSync(link: link, isFocused: isFocused.wrappedValue) { isFocused.wrappedValue = $0 })
    }

    /// Mirrors a field's own focus, read as `isFocused` and moved with `focus`, and the caller's link both ways.
    func fieldFocusSync(_ link: FieldFocusLink?, isFocused: Bool, focus: @escaping (Bool) -> Void) -> some View {
        modifier(FieldFocusSync(link: link, isFocused: isFocused, focus: focus))
    }
}

private struct FieldFocusSync: ViewModifier {
    let link: FieldFocusLink?
    let isFocused: Bool
    let focus: (Bool) -> Void

    func body(content: Content) -> some View {
        content
            .onChange(of: link?.isFocused(), initial: true) { _, wanted in
                if let wanted, wanted != isFocused { focus(wanted) }
            }
            .onChange(of: isFocused) { _, focused in
                if let link, link.isFocused() != focused { link.setFocused(focused) }
            }
    }
}

extension EnvironmentValues {
    /// Fields below draw their value with tabular digits, so codes and numbers line up.
    @Entry var fieldMonospacedDigits = false
}

extension View {
    /// Draws the value of every Kobo field below with tabular digits: account numbers, codes, measurements. A modifier
    /// at the call site, like `keyboardType(_:)` and `textContentType(_:)`, which also pass through to Kobo fields.
    ///
    ///     KoboTextField("Member number", text: $number).fieldMonospacedDigits()
    public func fieldMonospacedDigits(_ isOn: Bool = true) -> some View {
        environment(\.fieldMonospacedDigits, isOn)
    }
}
