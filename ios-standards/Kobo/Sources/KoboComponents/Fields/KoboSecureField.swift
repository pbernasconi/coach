import KoboTokens
import SwiftUI

/// A password field with a reveal toggle and an optional live rule checklist. One line, no autocapitalisation, no
/// autocorrection. `.newPassword` asks the system to suggest and save a strong password; `.password` offers the saved
/// one. The eye always owns the trailing slot, so the field never jumps as text arrives.
///
///     KoboSecureField("Password", text: $password, error: signInError)
///     KoboSecureField("New password", text: $password, content: .newPassword,
///                     rules: [.minimumLength(12), .mixedCase, .digit, .symbol])
public struct KoboSecureField: View {
    /// What the system offers to fill.
    public enum Content: Sendable, Hashable {
        /// A saved password.
        case password
        /// A new password: the system suggests a strong one and offers to save it.
        case newPassword
    }

    @Environment(\.koboTheme) private var theme
    @FocusState private var focus: SecureFieldFocus?
    @State private var isRevealed: Bool
    private let label: Text
    private let text: Binding<String>
    private let prompt: Text?
    private let helper: Text?
    private let content: Content
    private let error: FieldError
    private let rules: [PasswordRule]
    private var focusLink: FieldFocusLink?

    /// - Parameters:
    ///   - rules: a checklist shown under the field, ticked live; gate the submit on `rules.allMet(by:)`.
    ///   - startsRevealed: shows the text at first (a new password the user just generated).
    public init(
        _ label: LocalizedStringKey,
        text: Binding<String>,
        prompt: LocalizedStringKey? = nil,
        content: Content = .password,
        helper: LocalizedStringKey? = nil,
        error: FieldError = .none,
        rules: [PasswordRule] = [],
        startsRevealed: Bool = false
    ) {
        let copy = FieldCopy(label: label, prompt: prompt, helper: helper)
        self.init(copy: copy, text: text, content: content, error: error, rules: rules, startsRevealed: startsRevealed)
    }

    /// A field whose copy is shown as is.
    public init(
        verbatim label: String,
        text: Binding<String>,
        prompt: String? = nil,
        content: Content = .password,
        helper: String? = nil,
        error: FieldError = .none,
        rules: [PasswordRule] = [],
        startsRevealed: Bool = false
    ) {
        let copy = FieldCopy(verbatim: label, prompt: prompt, helper: helper)
        self.init(copy: copy, text: text, content: content, error: error, rules: rules, startsRevealed: startsRevealed)
    }

    private init(
        copy: FieldCopy,
        text: Binding<String>,
        content: Content,
        error: FieldError,
        rules: [PasswordRule],
        startsRevealed: Bool
    ) {
        label = copy.label
        prompt = copy.prompt
        helper = copy.helper
        self.text = text
        self.content = content
        self.error = error
        self.rules = rules
        _isRevealed = State(initialValue: startsRevealed)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            FieldFrame(label: label, helper: helper, error: error, isFocused: focus != nil, value: text.wrappedValue) {
                fields
                RevealToggle(
                    isRevealed: isRevealed,
                    showLabel: Text("Show password", bundle: .module),
                    hideLabel: Text("Hide password", bundle: .module),
                    action: toggle
                )
                .padding(.trailing, -Space.md)
            }
            if !rules.isEmpty {
                PasswordRuleList(results: rules.evaluate(text.wrappedValue))
            }
        }
        .fieldFocusSync(focusLink, isFocused: focus != nil) { wanted in
            focus = wanted ? (isRevealed ? .plain : .secure) : nil
        }
    }

    /// Both fields stay in the tree and only the shown one takes touches, so a reveal keeps the keyboard up.
    private var fields: some View {
        ZStack {
            SecureField(text: text, prompt: styledPrompt) { label }
                .focused($focus, equals: .secure)
                .shown(!isRevealed)
                .fieldAccessibility(label: label, value: "", helper: helper, error: error)
            TextField(text: text, prompt: styledPrompt) { label }
                .focused($focus, equals: .plain)
                .shown(isRevealed)
                .fieldAccessibility(label: label, value: text.wrappedValue, helper: helper, error: error)
        }
        .labelsHidden()
        .secureFieldContent(content)
        .autocorrectionDisabled()
        .frame(maxWidth: .infinity, minHeight: Size.minTouch)
    }

    private var styledPrompt: Text? { prompt?.foregroundStyle(theme.palette.textTertiary) }

    private func toggle() {
        isRevealed.toggle()
        focus = SecureFieldFocus.after(toggle: focus, revealed: isRevealed)
    }
}

extension KoboSecureField {
    /// Links this field to a screen's `Bool` focus state.
    public func focused(by binding: FocusState<Bool>.Binding) -> KoboSecureField {
        var field = self
        field.focusLink = .bool(binding)
        return field
    }

    /// Links this field to one case of a screen's focus enum.
    public func focused<Value: Hashable>(by binding: FocusState<Value?>.Binding, equals value: Value) -> KoboSecureField
    {
        var field = self
        field.focusLink = .value(binding, equals: value)
        return field
    }
}

extension View {
    /// Shown, or kept in the tree with no pixels, no touches and no VoiceOver element.
    fileprivate func shown(_ isShown: Bool) -> some View {
        opacity(isShown ? 1 : 0)
            .allowsHitTesting(isShown)
            .accessibilityHidden(!isShown)
    }

    /// The autofill hint and keyboard settings of a password field.
    @ViewBuilder
    fileprivate func secureFieldContent(_ content: KoboSecureField.Content) -> some View {
        #if os(iOS)
            textContentType(content == .newPassword ? .newPassword : .password)
                .textInputAutocapitalization(.never)
        #else
            self
        #endif
    }
}

#if DEBUG
    private struct KoboSecureFieldGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var password = "correct horse"  // pragma: allowlist secret
        @State private var newPassword = "Correct7"  // pragma: allowlist secret

        var body: some View {
            ScrollView {
                VStack(spacing: Space.lg) {
                    KoboSecureField("Password", text: $password)
                    KoboSecureField(
                        "New password",
                        text: $newPassword,
                        content: .newPassword,
                        rules: [.minimumLength(12), .mixedCase, .digit, .symbol],
                        startsRevealed: true
                    )
                    KoboSecureField("Password", text: .constant("wrong"), error: .message("That password isn't right"))
                    KoboSecureField("Password", text: .constant("secret")).disabled(true)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Secure field") { KoboSecureFieldGallery() }
    #Preview("Secure field · dark, Lift") { KoboSecureFieldGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Secure field · AX3") { KoboSecureFieldGallery().dynamicTypeSize(.accessibility3) }
#endif
