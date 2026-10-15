import KoboTokens
import SwiftUI

/// One-time code cells for any verification flow: one hidden real text field takes typing, paste and autofill, and
/// the cells draw it. The caller owns the code: after a failed check it sets an error (the row shakes once with the
/// error haptic) and clears the code, and the caret returns to the first cell. `onComplete` fires once per new
/// complete code, never twice for the same autofill. VoiceOver reads one field; a PIN only says how many characters
/// are in.
///
///     CodeInput("Verification code", code: $code, error: codeError) { code in verify(code) }
///     CodeInput("PIN", code: $pin, length: 4, mode: .pin)
public struct CodeInput: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @FocusState private var isFocused: Bool
    @State private var completion = CodeCompletion()
    @State private var shakes = 0
    private let label: Text
    private let code: Binding<String>
    private let length: Int
    private let mode: CodeInputMode
    private let error: FieldError
    private let onComplete: ((String) -> Void)?
    private var focusLink: FieldFocusLink?

    /// - Parameters:
    ///   - label: what VoiceOver calls the field ("Verification code"); not shown.
    ///   - length: the number of cells.
    ///   - error: draws every cell's danger ring; a message shows under the cells.
    public init(
        _ label: LocalizedStringKey,
        code: Binding<String>,
        length: Int = 6,
        mode: CodeInputMode = .oneTimeCode,
        error: FieldError = .none,
        onComplete: ((String) -> Void)? = nil
    ) {
        self.label = Text(label)
        self.code = code
        self.length = max(length, 1)
        self.mode = mode
        self.error = error
        self.onComplete = onComplete
    }

    public var body: some View {
        let count = code.wrappedValue.count
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: Space.sm) {
                ForEach(CodeInputLogic.slots(code: code.wrappedValue, length: length)) { slot in
                    CodeCell(
                        character: slot.character,
                        isActive: isFocused && isEnabled && slot.id == activeIndex,
                        showsCaret: isFocused && isEnabled && slot.id == count,
                        isError: error.isError,
                        masked: mode == .pin
                    )
                }
            }
            .accessibilityHidden(true)
            .overlay { hiddenField }
            .shake(trigger: shakes)
            FieldLine(helper: nil, content: FieldLineContent(hasHelper: false, error: error))
                .accessibilityHidden(true)
        }
        .onChange(of: code.wrappedValue, initial: true) { _, next in receive(next) }
        .onChange(of: error.isError) { _, isError in if isError { shakes += 1 } }
        .koboFeedback(shakes == 0 ? nil : .error, trigger: shakes)
        .fieldFocusSync(focusLink, isFocused: $isFocused)
    }

    private var activeIndex: Int {
        CodeInputLogic.activeIndex(codeCount: code.wrappedValue.count, length: length)
    }

    /// The real field: nearly transparent (a fully transparent view takes no touches and has no VoiceOver element),
    /// stretched over the cells so a tap anywhere on them focuses it.
    @ViewBuilder
    private var hiddenField: some View {
        Group {
            if mode == .pin {
                SecureField(text: code) { label }
            } else {
                TextField(text: code) { label }
                    .codeContentType(mode)
            }
        }
        .labelsHidden()
        .focused($isFocused)
        .codeKeyboard(mode)
        .autocorrectionDisabled()
        .foregroundStyle(Color.clear)
        .tint(Color.clear)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .opacity(CodeInputMetrics.hiddenFieldOpacity)
        .accessibilityLabel(label)
        .accessibilityValue(spokenValue)
        .accessibilityHint(error.message.map { Text(verbatim: $0) } ?? Text(verbatim: ""))
    }

    private var spokenValue: Text {
        let count = code.wrappedValue.count
        guard CodeInputLogic.speaksCode(mode) else { return Text("\(count) of \(length) entered", bundle: .module) }
        return Text(verbatim: code.wrappedValue)
    }

    private func receive(_ next: String) {
        let clean = CodeInputLogic.sanitize(next, length: length, mode: mode)
        if clean != next { code.wrappedValue = clean }
        if let complete = completion.receive(clean, length: length) { onComplete?(complete) }
    }
}

extension View {
    /// The system's code autofill for a one-time code. Off iOS it does nothing.
    @ViewBuilder
    fileprivate func codeContentType(_ mode: CodeInputMode) -> some View {
        #if os(iOS)
            textContentType(mode == .oneTimeCode ? .oneTimeCode : nil)
        #else
            self
        #endif
    }

    /// A number pad for digit codes, an ASCII keyboard in capitals for letter codes. Off iOS it does nothing.
    @ViewBuilder
    fileprivate func codeKeyboard(_ mode: CodeInputMode) -> some View {
        #if os(iOS)
            keyboardType(mode == .alphanumeric ? .asciiCapable : .numberPad)
                .textInputAutocapitalization(mode == .alphanumeric ? .characters : .never)
        #else
            self
        #endif
    }
}

extension CodeInput {
    /// Links this field to a screen's `Bool` focus state, so a screen can focus it on arrival.
    public func focused(by binding: FocusState<Bool>.Binding) -> CodeInput {
        var input = self
        input.focusLink = .bool(binding)
        return input
    }
}

enum CodeInputMetrics {
    /// Opacity 0 would remove the field from hit testing and from VoiceOver.
    static let hiddenFieldOpacity = 0.011
}

#if DEBUG
    private struct CodeInputGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var code = "123"
        @State private var pin = "12"
        @State private var invite = ""

        var body: some View {
            ScrollView {
                VStack(spacing: Space.xxl) {
                    CodeInput("Verification code", code: $code)
                    CodeInput("PIN", code: $pin, length: 4, mode: .pin)
                    CodeInput("Invite code", code: $invite, mode: .alphanumeric)
                    CodeInput("Verification code", code: .constant("12"), error: .message("That code didn't work"))
                    CodeInput("Verification code", code: .constant("12")).disabled(true)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Code input") { CodeInputGallery() }
    #Preview("Code input · dark, Amber") { CodeInputGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Code input · AX3") { CodeInputGallery().dynamicTypeSize(.accessibility3) }
#endif
