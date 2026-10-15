import KoboTokens
import SwiftUI

/// A multi-line text field that starts `lines.lowerBound` lines tall and grows with the text to
/// `lines.upperBound`, then scrolls. With a `characterLimit` it stops at the limit (counting characters as people see
/// them) and shows a counter that warns near the limit; reaching it plays the warning haptic and is announced once.
///
///     KoboTextArea("Notes", text: $notes, prompt: "How did it feel?", characterLimit: 280)
public struct KoboTextArea: View {
    @Environment(\.koboTheme) private var theme
    @FocusState private var isFocused: Bool
    private let label: Text
    private let text: Binding<String>
    private let prompt: Text?
    private let helper: Text?
    private let error: FieldError
    private let lines: ClosedRange<Int>
    private let characterLimit: Int?
    private var focusLink: FieldFocusLink?

    /// - Parameters:
    ///   - lines: the resting height and the most lines it grows to before it scrolls.
    ///   - characterLimit: the most characters it takes; `nil` for no limit and no counter.
    public init(
        _ label: LocalizedStringKey,
        text: Binding<String>,
        prompt: LocalizedStringKey? = nil,
        helper: LocalizedStringKey? = nil,
        error: FieldError = .none,
        lines: ClosedRange<Int> = 3...8,
        characterLimit: Int? = nil
    ) {
        let copy = FieldCopy(label: label, prompt: prompt, helper: helper)
        self.init(copy: copy, text: text, error: error, lines: lines, characterLimit: characterLimit)
    }

    /// A text area whose copy is shown as is.
    public init(
        verbatim label: String,
        text: Binding<String>,
        prompt: String? = nil,
        helper: String? = nil,
        error: FieldError = .none,
        lines: ClosedRange<Int> = 3...8,
        characterLimit: Int? = nil
    ) {
        let copy = FieldCopy(verbatim: label, prompt: prompt, helper: helper)
        self.init(copy: copy, text: text, error: error, lines: lines, characterLimit: characterLimit)
    }

    private init(copy: FieldCopy, text: Binding<String>, error: FieldError, lines: ClosedRange<Int>, characterLimit: Int?) {
        label = copy.label
        prompt = copy.prompt
        helper = copy.helper
        self.text = text
        self.error = error
        self.lines = lines
        self.characterLimit = characterLimit
    }

    public var body: some View {
        FieldFrame(
            label: label,
            helper: helper,
            error: error,
            isFocused: isFocused,
            value: text.wrappedValue,
            boxAlignment: .top
        ) {
            TextField(text: text, prompt: prompt?.foregroundStyle(theme.palette.textTertiary), axis: .vertical) {
                label
            }
            .labelsHidden()
            .lineLimit(lines)
            .focused($isFocused)
            .padding(.vertical, Space.md)
            .fieldAccessibility(label: label, value: text.wrappedValue, helper: helper, error: error)
        } footer: {
            if let characterLimit {
                CharacterCounterText(count: count, limit: characterLimit)
            }
        }
        .onChange(of: text.wrappedValue) { _, new in clamp(new) }
        .onChange(of: isAtLimit) { _, atLimit in
            if atLimit { AccessibilityNotification.Announcement(limitAnnouncement).post() }
        }
        .koboFeedback(trigger: isAtLimit) { _, atLimit in atLimit ? .warning : nil }
        .fieldFocusSync(focusLink, isFocused: $isFocused)
    }

    private var count: Int { CharacterCounter.count(text.wrappedValue) }

    private var isAtLimit: Bool {
        characterLimit.map { CharacterCounter.isAtLimit(count: count, limit: $0) } ?? false
    }

    private var limitAnnouncement: String {
        String(localized: "Character limit reached", bundle: .module)
    }

    private func clamp(_ new: String) {
        guard let characterLimit else { return }
        let clamped = CharacterCounter.clamped(new, to: characterLimit)
        if clamped != new { text.wrappedValue = clamped }
    }
}

extension KoboTextArea {
    /// Links this field to a screen's `Bool` focus state.
    public func focused(by binding: FocusState<Bool>.Binding) -> KoboTextArea {
        var field = self
        field.focusLink = .bool(binding)
        return field
    }

    /// Links this field to one case of a screen's focus enum.
    public func focused<Value: Hashable>(by binding: FocusState<Value?>.Binding, equals value: Value) -> KoboTextArea {
        var field = self
        field.focusLink = .value(binding, equals: value)
        return field
    }
}

#if DEBUG
    private struct KoboTextAreaGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var notes = ""
        @State private var cue = "Brace before each rep, drive through the heels."

        var body: some View {
            ScrollView {
                VStack(spacing: Space.lg) {
                    KoboTextArea("Notes", text: $notes, prompt: "How did it feel?", helper: "Only you see this")
                    KoboTextArea("Coaching cue", text: $cue, lines: 2...4, characterLimit: 50)
                    KoboTextArea("Reason", text: .constant(" "), error: .message("Add a short reason"))
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Text area") { KoboTextAreaGallery() }
    #Preview("Text area · dark, Lift") { KoboTextAreaGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Text area · AX3") { KoboTextAreaGallery().dynamicTypeSize(.accessibility3) }
#endif
