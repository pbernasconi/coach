import KoboTokens
import SwiftUI

/// The message field at the bottom of a chat: a field that grows to six lines, and one round button beside it that
/// sends, or stops a reply in progress. Return adds a line; the button sends. Blank drafts cannot be sent. Under a glass
/// theme the field and the button are Liquid Glass in one container, for a bar over the transcript; place it with
/// `.safeAreaBar(edge: .bottom)`. The keyboard's microphone dictates into it.
///
///     ChatComposer(text: $draft, prompt: "Message", isResponding: isWaiting, onSend: send, onStop: stop)
public struct ChatComposer: View {
    @Environment(\.koboTheme) private var theme
    private let text: Binding<String>
    private let prompt: Text
    private let isResponding: Bool
    private let onSend: () -> Void
    private let onStop: (() -> Void)?
    private var focus: FocusState<Bool>.Binding?

    /// A composer. `onStop` adds the stop button while `isResponding`; without it the send button waits, disabled.
    public init(
        text: Binding<String>,
        prompt: LocalizedStringKey,
        isResponding: Bool = false,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)? = nil
    ) {
        self.init(text: text, prompt: Text(prompt), isResponding: isResponding, onSend: onSend, onStop: onStop)
    }

    /// A composer whose placeholder is runtime text ("Message Alex").
    public init(
        text: Binding<String>,
        verbatimPrompt: String,
        isResponding: Bool = false,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)? = nil
    ) {
        self.init(
            text: text,
            prompt: Text(verbatim: verbatimPrompt),
            isResponding: isResponding,
            onSend: onSend,
            onStop: onStop
        )
    }

    private init(
        text: Binding<String>,
        prompt: Text,
        isResponding: Bool,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)?
    ) {
        self.text = text
        self.prompt = prompt
        self.isResponding = isResponding
        self.onSend = onSend
        self.onStop = onStop
    }

    /// Links the field to a screen's focus state (a quick prompt can fill it and raise the keyboard).
    public func focused(by binding: FocusState<Bool>.Binding) -> ChatComposer {
        var composer = self
        composer.focus = binding
        return composer
    }

    public var body: some View {
        GlassEffectContainer(spacing: Space.sm) {
            HStack(alignment: .bottom, spacing: Space.sm) {
                ChatComposerField(text: text, prompt: prompt, focus: focus)
                trailingButton
            }
        }
        .padding(.horizontal, Space.gutter)
        .padding(.vertical, Space.sm)
    }

    @ViewBuilder
    private var trailingButton: some View {
        switch ChatComposerLogic.button(draft: text.wrappedValue, isResponding: isResponding, canStop: onStop != nil) {
        case .send(let isEnabled):
            IconButton("arrow.up", label: Text("Send", bundle: .module), style: .solid, size: .regular, action: onSend)
                .disabled(!isEnabled)
        case .stop:
            IconButton("stop.fill", label: Text("Stop", bundle: .module), style: .solid, size: .regular) { onStop?() }
        case .waiting:
            IconButton("arrow.up", label: Text("Send", bundle: .module), style: .solid, size: .regular, action: onSend)
                .disabled(true)
        }
    }
}

/// The growing field: a rounded glass shape under a glass theme, else the surface with a hairline.
private struct ChatComposerField: View {
    @Environment(\.koboTheme) private var theme
    @FocusState private var isFocused: Bool
    let text: Binding<String>
    let prompt: Text
    let focus: FocusState<Bool>.Binding?

    var body: some View {
        TextField(text: text, prompt: prompt.foregroundStyle(theme.palette.textTertiary), axis: .vertical) { prompt }
            .labelsHidden()
            .lineLimit(1...6)
            .focused($isFocused)
            .font(theme.font(.body))
            .foregroundStyle(theme.palette.textPrimary)
            .tint(theme.palette.accent)
            .padding(.horizontal, Space.lg)
            .padding(.vertical, Space.md - Space.xxs)
            .frame(minHeight: Size.minTouch)
            .modifier(ChatComposerSurface())
            .onChange(of: focus?.wrappedValue) { _, wanted in
                if let wanted, wanted != isFocused { isFocused = wanted }
            }
            .onChange(of: isFocused) { _, now in
                if let focus, focus.wrappedValue != now { focus.wrappedValue = now }
            }
    }
}

private struct ChatComposerSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Radius.lg + Space.xxs)
        if theme.surfaceStyle == .glass {
            content.glassEffect(.regular.interactive(), in: shape)
        } else {
            content
                .background(theme.palette.surface, in: shape)
                .overlay { shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline) }
        }
    }
}

#if DEBUG
    private struct ChatComposerPreview: View {
        @State private var empty = ""
        @State private var draft = "Can we move the review to tomorrow morning?"

        var body: some View {
            VStack(spacing: Space.lg) {
                Spacer()
                ChatComposer(text: $empty, prompt: "Message", onSend: {})
                ChatComposer(text: $draft, prompt: "Message", onSend: {})
                ChatComposer(text: $empty, prompt: "Message", isResponding: true, onSend: {}, onStop: {})
            }
            .screenCanvas()
        }
    }

    #Preview("Composer") { ChatComposerPreview() }
    #Preview("Composer · dark, solid") {
        ChatComposerPreview().koboTheme(Theme(palette: .amber, surfaceStyle: .solid)).preferredColorScheme(.dark)
    }
    #Preview("Composer · AX3") { ChatComposerPreview().dynamicTypeSize(.accessibility3) }
#endif
