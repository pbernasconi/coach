import KoboTokens
import SwiftUI

/// The message field at the bottom of a chat. At rest it is a single-line capsule with one round button inside (send
/// with a draft, stop while a reply can be stopped, else the microphone). With focus, or while the microphone listens,
/// it opens into a card: the field on top, growing to eight lines, and a toolbar under it with the listening level on
/// the left and the microphone and Send (dimmed while the draft is blank) on the right. Return adds a line; Send sends.
/// Place it with `.safeAreaBar(edge: .bottom)`. `voice` adds the microphone (`ChatVoice`).
///
///     ChatComposer(text: $draft, prompt: "Message", isResponding: isWaiting, onSend: send, onStop: stop, voice: voice)
public struct ChatComposer: View {
    @Environment(\.koboTheme) private var theme
    @FocusState private var isFocused: Bool
    /// A hold just ended: the mic button's own tap, which can come after, is skipped.
    @State private var endedHold = false
    private let text: Binding<String>
    private let prompt: Text
    private let isResponding: Bool
    private let onSend: () -> Void
    private let onStop: (() -> Void)?
    private let voice: ChatVoice?
    private var focus: FocusState<Bool>.Binding?

    /// A composer. `onStop` adds the stop button while `isResponding`; without it the send button waits, disabled.
    public init(
        text: Binding<String>,
        prompt: LocalizedStringKey,
        isResponding: Bool = false,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)? = nil,
        voice: ChatVoice? = nil
    ) {
        self.init(text, Text(prompt), isResponding, onSend, onStop, voice)
    }

    /// A composer whose placeholder is runtime text ("Message Alex").
    public init(
        text: Binding<String>,
        verbatimPrompt: String,
        isResponding: Bool = false,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)? = nil,
        voice: ChatVoice? = nil
    ) {
        self.init(text, Text(verbatim: verbatimPrompt), isResponding, onSend, onStop, voice)
    }

    private init(
        _ text: Binding<String>,
        _ prompt: Text,
        _ isResponding: Bool,
        _ onSend: @escaping () -> Void,
        _ onStop: (() -> Void)?,
        _ voice: ChatVoice?
    ) {
        self.text = text
        self.prompt = prompt
        self.isResponding = isResponding
        self.onSend = onSend
        self.onStop = onStop
        self.voice = voice
    }

    /// Links the field to a screen's focus state (a quick prompt can fill it and raise the keyboard).
    public func focused(by binding: FocusState<Bool>.Binding) -> ChatComposer {
        var composer = self
        composer.focus = binding
        return composer
    }

    private var isListening: Bool { voice?.phase == .listening || voice?.phase == .holding }
    private var isExpanded: Bool { ChatComposerLogic.isExpanded(isFocused: isFocused, isListening: isListening) }

    public var body: some View {
        VStack(spacing: Space.xs) {
            if voice?.phase == .unavailable, let open = voice?.onOpenSettings {
                ChatVoiceDeniedRow(openSettings: open)
            }
            VStack(alignment: .leading, spacing: isExpanded ? Space.xs : 0) {
                HStack(alignment: .bottom, spacing: Space.xs) {
                    field
                    if !isExpanded { compactButton }
                }
                if isExpanded { toolbar }
            }
            .padding(.leading, Space.lg)
            .padding(.trailing, Space.xs)
            .padding(.vertical, Space.xxs)
            .modifier(ChatComposerSurface(isExpanded: isExpanded))
        }
        .padding(.horizontal, Space.gutter)
        .padding(.vertical, Space.sm)
        .koboAnimation(.present, value: isExpanded)
        // The finger that holds the microphone lifts here: the button itself moved when listening began.
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in if voice?.phase != .holding { endedHold = false } }
                .onEnded { _ in
                    guard let voice, voice.phase == .holding else { return }
                    endedHold = true
                    voice.onHoldEnded()
                }
        )
        // The field keeps its own focus, kept equal to the screen's (writes to a focus state no field uses are lost).
        .onChange(of: focus?.wrappedValue) { _, wanted in
            if let wanted, wanted != isFocused { isFocused = wanted }
        }
        .onChange(of: isFocused) { _, now in
            if let focus, focus.wrappedValue != now { focus.wrappedValue = now }
        }
    }

    private var field: some View {
        TextField(text: text, prompt: prompt.foregroundStyle(theme.palette.textTertiary), axis: .vertical) { prompt }
            .labelsHidden()
            .lineLimit(1...8)
            .focused($isFocused)
            .font(theme.font(.body))
            .foregroundStyle(theme.palette.textPrimary)
            .tint(theme.palette.accent)
            .padding(.vertical, Space.sm + Space.xxs)
            .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
    }

    @ViewBuilder
    private var compactButton: some View {
        switch ChatComposerLogic.compactButton(
            draft: text.wrappedValue,
            isResponding: isResponding,
            canStop: onStop != nil,
            hasVoice: voice != nil
        )
        {
        case .send: sendButton(look: .accent)
        case .stop: stopButton
        case .microphone: if let voice { micButton(voice) }
        case .none: EmptyView()
        }
    }

    private var toolbar: some View {
        HStack(spacing: Space.xs) {
            if isListening, let voice { ChatVoiceLevel(phase: voice.phase, level: voice.level) }
            Spacer(minLength: 0)
            if let voice { micButton(voice) }
            switch ChatComposerLogic.button(
                draft: text.wrappedValue,
                isResponding: isResponding,
                canStop: onStop != nil
            ) {
            case .send(let isEnabled): sendButton(look: isEnabled ? .accent : .dimmed)
            case .stop: stopButton
            case .waiting: sendButton(look: .dimmed)
            }
        }
    }

    private func micButton(_ voice: ChatVoice) -> some View {
        ChatMicButton(
            phase: voice.phase,
            onTap: { if endedHold { endedHold = false } else { voice.onTap() } },
            onHoldBegan: voice.onHoldBegan
        )
    }

    private func sendButton(look: ChatRoundButton.Look) -> some View {
        ChatRoundButton(systemImage: "arrow.up", label: Text("Send", bundle: .module), look: look, action: onSend)
    }

    private var stopButton: some View {
        ChatRoundButton(systemImage: "stop.fill", label: Text("Stop", bundle: .module), look: .accent) { onStop?() }
    }
}

/// At rest, a capsule of Liquid Glass (or the surface with a hairline under a solid theme); open, a rounded card with
/// the surface fill and a hairline. One modifier chain for both shapes: a branch would rebuild the field and drop focus.
private struct ChatComposerSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let isExpanded: Bool

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(
            cornerRadius: isExpanded ? Radius.lg + Space.xs : Radius.lg + Space.xxs,
            style: .continuous
        )
        let isGlass = theme.surfaceStyle == .glass && !isExpanded
        content
            .background(isGlass ? Color.clear : theme.palette.surface, in: shape)
            .overlay { shape.strokeBorder(theme.palette.separator.opacity(isGlass ? 0 : 1), lineWidth: Size.hairline) }
            .glassEffect(isGlass ? .regular.interactive() : .identity, in: shape)
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
                ChatComposer(
                    text: $draft,
                    prompt: "Message",
                    onSend: {},
                    voice: ChatVoice(phase: .listening, level: 0.6, onTap: {}, onHoldBegan: {}, onHoldEnded: {})
                )
                ChatComposer(
                    text: $empty,
                    prompt: "Message",
                    onSend: {},
                    voice: ChatVoice(
                        phase: .unavailable,
                        onTap: {},
                        onHoldBegan: {},
                        onHoldEnded: {},
                        onOpenSettings: {}
                    )
                )
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
