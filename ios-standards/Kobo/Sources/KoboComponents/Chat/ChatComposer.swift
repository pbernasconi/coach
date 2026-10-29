import KoboTokens
import SwiftUI

/// The message field at the bottom of a chat. Empty, it is a raised single-line capsule: the + at the leading edge, the
/// placeholder, the microphone, and the send button, a grey circle until there is something to send. With a draft,
/// while the microphone listens, or with attachments, it opens into a rounded card: the field on top, growing to eight
/// lines, and a toolbar under it with the + on the left and the microphone and Send (an accent circle) on the right.
/// While a reply runs, Send turns into a grey stop square. Return adds a line; Send sends. Place it with
/// `.safeAreaBar(edge: .bottom)`; `.backdrop(_:)` paints a fade of the screen's colour behind it, so text scrolls under
/// cleanly. `voice` adds the microphone (`ChatVoice`); `attach` adds the + and the attached photos and files above the
/// field (`ChatAttach`), and Send waits for their uploads.
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
    private let attach: ChatAttach?
    private var focus: FocusState<Bool>.Binding?
    private var backdrop: Color?
    private var restsAsCard = false

    /// A composer. `onStop` adds the stop button while `isResponding`; without it the send button waits, disabled.
    public init(
        text: Binding<String>,
        prompt: LocalizedStringKey,
        isResponding: Bool = false,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)? = nil,
        voice: ChatVoice? = nil,
        attach: ChatAttach? = nil
    ) {
        self.init(text, Text(prompt), isResponding, onSend, onStop, voice, attach)
    }

    /// A composer whose placeholder is runtime text ("Message Alex").
    public init(
        text: Binding<String>,
        verbatimPrompt: String,
        isResponding: Bool = false,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)? = nil,
        voice: ChatVoice? = nil,
        attach: ChatAttach? = nil
    ) {
        self.init(text, Text(verbatim: verbatimPrompt), isResponding, onSend, onStop, voice, attach)
    }

    private init(
        _ text: Binding<String>,
        _ prompt: Text,
        _ isResponding: Bool,
        _ onSend: @escaping () -> Void,
        _ onStop: (() -> Void)?,
        _ voice: ChatVoice?,
        _ attach: ChatAttach?
    ) {
        self.text = text
        self.prompt = prompt
        self.isResponding = isResponding
        self.onSend = onSend
        self.onStop = onStop
        self.voice = voice
        self.attach = attach
    }

    /// Links the field to a screen's focus state (a quick prompt can fill it and raise the keyboard).
    public func focused(by binding: FocusState<Bool>.Binding) -> ChatComposer {
        var composer = self
        composer.focus = binding
        return composer
    }

    /// Paints `color` behind the composer, fading in above it, so the conversation scrolls under it cleanly. Pass the
    /// screen's own background; `nil` (the default) leaves what is behind it showing.
    public func backdrop(_ color: Color?) -> ChatComposer {
        var composer = self
        composer.backdrop = color
        return composer
    }

    /// Keeps the open card at rest too, as the system's own assistant apps do: the field on top, and the + , the
    /// microphone and Send as round buttons under it. Focus only raises the keyboard; the card grows with more lines.
    public func restsAsCard(_ value: Bool = true) -> ChatComposer {
        var composer = self
        composer.restsAsCard = value
        return composer
    }

    private var isListening: Bool { voice?.phase == .listening || voice?.phase == .holding }
    private var isExpanded: Bool {
        let hasAttachments = !(attach?.items.isEmpty ?? true)
        let opens = ChatComposerLogic.isExpanded(
            draft: text.wrappedValue,
            isListening: isListening,
            hasAttachments: hasAttachments
        )
        return restsAsCard || opens
    }
    private var attachments: ChatComposerLogic.Attachments { attach?.readiness ?? .none }

    public var body: some View {
        VStack(spacing: Space.xs) {
            if voice?.phase == .unavailable, let open = voice?.onOpenSettings {
                ChatVoiceDeniedRow(openSettings: open)
            }
            VStack(alignment: .leading, spacing: isExpanded ? Space.xs : 0) {
                if let attach, !attach.items.isEmpty {
                    ChatAttachmentStrip(
                        attach.items,
                        preview: attach.preview,
                        onRemove: attach.onRemove,
                        onRetry: attach.onRetry
                    )
                    .padding(.top, Space.sm)
                }
                HStack(alignment: .center, spacing: 0) {
                    if !isExpanded, let attach { attachButton(attach) }
                    field
                        // Open, the toolbar holds the buttons: the text keeps the same room on both sides.
                        .padding(.trailing, isExpanded ? Space.lg - Space.xs : 0)
                    if !isExpanded {
                        if let voice { micButton(voice) }
                        sendButton
                    }
                }
                if isExpanded { toolbar }
            }
            .padding(.leading, attach != nil && !isExpanded ? Space.xxs : Space.md + Space.xxs)
            .padding(.trailing, isExpanded ? Space.sm : Space.xs)
            .padding(.top, isExpanded ? Space.xs : Space.xxs + Space.xxs)
            .padding(.bottom, isExpanded ? Space.sm : Space.xxs + Space.xxs)
            .modifier(ChatComposerSurface(isExpanded: isExpanded))
        }
        .padding(.horizontal, Space.gutter)
        .padding(.vertical, Space.xs)
        .background { ChatComposerBackdrop(color: backdrop) }
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
        TextField(text: text, prompt: prompt.foregroundStyle(theme.palette.textSecondary), axis: .vertical) { prompt }
            .labelsHidden()
            .lineLimit(1...8)
            .focused($isFocused)
            .font(theme.font(.body))
            .foregroundStyle(theme.palette.textPrimary)
            .tint(theme.palette.accent)
            .padding(.top, isExpanded ? Space.sm + Space.xxs : Space.sm + Space.xxs)
            .padding(.bottom, isExpanded ? Space.xs + Space.xxs : Space.sm + Space.xxs)
            .frame(maxWidth: .infinity, minHeight: isExpanded ? 0 : Size.minTouch, alignment: .leading)
    }

    /// Send (grey until there is something to send, then the accent), or the grey stop square while a reply runs.
    @ViewBuilder
    private var sendButton: some View {
        switch ChatComposerLogic.button(
            draft: text.wrappedValue,
            attachments: attachments,
            isResponding: isResponding,
            canStop: onStop != nil
        ) {
        case .send(let isEnabled): sendButton(look: isEnabled ? .accent : (isExpanded ? .muted : .dimmed))
        case .stop: stopButton
        case .waiting: sendButton(look: .dimmed)
        }
    }

    private var toolbar: some View {
        HStack(spacing: Space.xs) {
            if let attach {
                // The + lines up with the card's edge as the send button does on the other side.
                attachButton(attach, isFilled: true).padding(.leading, Space.sm - Space.md - Space.xxs)
            }
            if isListening, let voice { ChatVoiceLevel(phase: voice.phase, level: voice.level) }
            Spacer(minLength: 0)
            if let voice { micButton(voice, isFilled: true) }
            sendButton
        }
    }

    private func attachButton(_ attach: ChatAttach, isFilled: Bool = false) -> some View {
        ChatAttachButton(isEnabled: attach.canAdd, isFilled: isFilled, action: attach.onAdd)
    }

    private func micButton(_ voice: ChatVoice, isFilled: Bool = false) -> some View {
        ChatMicButton(
            phase: voice.phase,
            isFilled: isFilled,
            onTap: { if endedHold { endedHold = false } else { voice.onTap() } },
            onHoldBegan: voice.onHoldBegan
        )
    }

    private func sendButton(look: ChatRoundButton.Look) -> some View {
        ChatRoundButton(systemImage: "arrow.up", label: Text("Send", bundle: .module), look: look, action: onSend)
    }

    private var stopButton: some View {
        ChatRoundButton(systemImage: "stop.fill", label: Text("Stop", bundle: .module), look: .quiet) { onStop?() }
    }
}
