import KoboTokens
import SwiftUI

/// A single-line text field: a label above, a prompt inside, optional unit suffix ("km"), clear button and
/// leading/trailing slots, and helper text or an error below. Errors show only after the user leaves the field or
/// submits. Keyboard type, content type, submit label and autocapitalisation are the usual SwiftUI modifiers at the
/// call site; they pass through to the field. Link a screen's `@FocusState` with `focused(by:)`.
///
///     KoboTextField("Email", text: $email, prompt: "name@example.com", error: emailError)
///         .keyboardType(.emailAddress).textContentType(.emailAddress).submitLabel(.next)
///         .focused(by: $focus, equals: .email)
///     KoboTextField("Distance", text: $distance, unit: "km").keyboardType(.decimalPad)
public struct KoboTextField<Leading: View, Trailing: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.fieldMonospacedDigits) private var monospacedDigits
    @FocusState private var isFocused: Bool
    private let label: Text
    private let text: Binding<String>
    private let prompt: Text?
    private let helper: Text?
    private let unit: Text?
    private let error: FieldError
    private let clearable: Bool
    private let leading: Leading
    private let trailing: Trailing
    private var focusLink: FieldFocusLink?

    /// A field with leading and trailing slots (an icon, a small button).
    ///
    /// - Parameters:
    ///   - prompt: shown inside the box while it is empty.
    ///   - helper: the line under the box; VoiceOver reads it as the hint.
    ///   - unit: a suffix after the text ("km", "min"), also spoken after the value.
    ///   - error: the validation state; shown after the user leaves the field or submits.
    ///   - clearable: shows a clear button while the field is enabled and has text.
    public init(
        _ label: LocalizedStringKey,
        text: Binding<String>,
        prompt: LocalizedStringKey? = nil,
        helper: LocalizedStringKey? = nil,
        unit: LocalizedStringKey? = nil,
        error: FieldError = .none,
        clearable: Bool = false,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(
            copy: FieldCopy(label: label, prompt: prompt, helper: helper, unit: unit),
            text: text,
            error: error,
            clearable: clearable,
            leading: leading(),
            trailing: trailing()
        )
    }

    /// The one place every initialiser lands.
    init(
        copy: FieldCopy,
        text: Binding<String>,
        error: FieldError,
        clearable: Bool,
        leading: Leading,
        trailing: Trailing
    ) {
        self.label = copy.label
        self.text = text
        self.prompt = copy.prompt
        self.helper = copy.helper
        self.unit = copy.unit
        self.error = error
        self.clearable = clearable
        self.leading = leading
        self.trailing = trailing
    }

    public var body: some View {
        FieldFrame(label: label, helper: helper, error: error, isFocused: isFocused, value: text.wrappedValue) {
            if Leading.self != EmptyView.self {
                leading.foregroundStyle(theme.palette.textSecondary)
            }
            TextField(text: text, prompt: prompt?.foregroundStyle(theme.palette.textTertiary)) { label }
                .labelsHidden()
                .focused($isFocused)
                .fieldDigits(monospacedDigits)
                .fieldAccessibility(label: label, value: text.wrappedValue, unit: unit, helper: helper, error: error)
            if let unit {
                unit
                    .foregroundStyle(theme.palette.textSecondary)
                    .fieldDigits(monospacedDigits)
                    .accessibilityHidden(true)
            }
            if InputClear.shows(clearable: clearable, text: text.wrappedValue, isEnabled: isEnabled) {
                FieldIconButton(systemImage: "xmark.circle.fill", label: Text("Clear text", bundle: .module)) {
                    text.wrappedValue = ""
                    isFocused = true
                }
                .padding(.trailing, -Space.md)
            }
            trailing
        }
        .fieldFocusSync(focusLink, isFocused: $isFocused)
    }
}

extension KoboTextField {
    /// Links this field to a screen's `Bool` focus state.
    public func focused(by binding: FocusState<Bool>.Binding) -> KoboTextField {
        var field = self
        field.focusLink = .bool(binding)
        return field
    }

    /// Links this field to one case of a screen's focus enum, so Return can move to the next field.
    public func focused<Value: Hashable>(by binding: FocusState<Value?>.Binding, equals value: Value) -> KoboTextField {
        var field = self
        field.focusLink = .value(binding, equals: value)
        return field
    }
}

extension KoboTextField where Leading == EmptyView {
    /// A field with a trailing slot (a small button, a status glyph).
    public init(
        _ label: LocalizedStringKey,
        text: Binding<String>,
        prompt: LocalizedStringKey? = nil,
        helper: LocalizedStringKey? = nil,
        unit: LocalizedStringKey? = nil,
        error: FieldError = .none,
        clearable: Bool = false,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(
            copy: FieldCopy(label: label, prompt: prompt, helper: helper, unit: unit),
            text: text,
            error: error,
            clearable: clearable,
            leading: EmptyView(),
            trailing: trailing()
        )
    }
}

extension KoboTextField where Leading == EmptyView, Trailing == EmptyView {
    /// A plain field.
    public init(
        _ label: LocalizedStringKey,
        text: Binding<String>,
        prompt: LocalizedStringKey? = nil,
        helper: LocalizedStringKey? = nil,
        unit: LocalizedStringKey? = nil,
        error: FieldError = .none,
        clearable: Bool = false
    ) {
        self.init(
            copy: FieldCopy(label: label, prompt: prompt, helper: helper, unit: unit),
            text: text,
            error: error,
            clearable: clearable,
            leading: EmptyView(),
            trailing: EmptyView()
        )
    }
}
