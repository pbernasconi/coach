import KoboTokens
import SwiftUI

/// The message field at the bottom of a chat, matched to the Claude iPhone app. At rest it is a raised single-line
/// capsule, 52 pt tall: a round + at the leading edge, the placeholder, a round microphone, and Send, the accent washed
/// out until there is something to send. Focused, with a draft, while the microphone listens, or with attachments, it
/// opens into a card with 24 pt corners, on the same gutter as the messages: the field on top, growing to eight lines, and a
/// toolbar under it with the + on the left and the microphone and Send on the right. While a reply runs, Send turns
/// into a grey stop square. Colours come from `palette.composer`. Return adds a line; Send sends. Place it with
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
    private var restingPrompt: Text?

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

    /// A shorter placeholder for the capsule at rest ("Type or hold to talk"); the card shows the main prompt.
    public func restingPrompt(_ prompt: LocalizedStringKey) -> ChatComposer {
        var composer = self
        composer.restingPrompt = Text(prompt)
        return composer
    }

    private var isListening: Bool { voice?.phase == .listening || voice?.phase == .holding }
    private var isExpanded: Bool {
        let hasAttachments = !(attach?.items.isEmpty ?? true)
        let opens = ChatComposerLogic.isExpanded(
            draft: text.wrappedValue,
            isListening: isListening,
            hasAttachments: hasAttachments,
            isFocused: isFocused
        )
        return restsAsCard || opens
    }
    private var attachments: ChatComposerLogic.Attachments { attach?.readiness ?? .none }

    public var body: some View {
        VStack(spacing: Space.xs) {
            if voice?.phase == .unavailable, let open = voice?.onOpenSettings {
                ChatVoiceDeniedRow(openSettings: open)
            }
            VStack(alignment: .leading, spacing: 0) {
                if let attach, !attach.items.isEmpty {
                    ChatAttachmentStrip(
                        attach.items,
                        preview: attach.preview,
                        onRemove: attach.onRemove,
                        onRetry: attach.onRetry
                    )
                    .padding(.top, Space.sm)
                    .padding(.horizontal, Space.sm)
                }
                HStack(alignment: .center, spacing: 0) {
                    if !isExpanded, let attach { attachButton(attach) }
                    field
                    if !isExpanded {
                        if let voice { micButton(voice) }
                        sendButton
                    }
                }
                if isExpanded { toolbar }
            }
            // The circles sit 8 pt in from the edge: 4 pt here, 4 pt inside their 44 pt targets.
            .padding(Space.xs)
            .modifier(ChatComposerSurface(isExpanded: isExpanded))
        }
        // Both shapes sit on the page gutter, lined up with the messages above (as the Claude app's text and pill do).
        .padding(.horizontal, Space.gutter)
        .padding(.top, Space.xs)
        .padding(.bottom, Space.sm)
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

    /// The placeholder: the shorter resting one in the capsule, when there is one.
    private var shownPrompt: Text { isExpanded ? prompt : (restingPrompt ?? prompt) }

    private var field: some View {
        TextField(text: text, prompt: shownPrompt.foregroundStyle(theme.palette.textSecondary), axis: .vertical) {
            prompt
        }
        .labelsHidden()
        .lineLimit(1...8)
        .focused($isFocused)
        .font(theme.font(.body))
        .foregroundStyle(theme.palette.textPrimary)
        .tint(theme.palette.accent)
        // Open: 15 pt above the first line and 13 pt down to the buttons' circles (98 pt in all at one line).
        .padding(.top, isExpanded ? Space.sm + Space.xxs + ChatComposerMetrics.edge : 0)
        .padding(.bottom, isExpanded ? Space.md + ChatComposerMetrics.edge - Space.xs : 0)
        // The text starts 13 pt in from the card's edge (13 pt after the + in the capsule), as in the Claude app.
        .padding(.horizontal, Space.sm + ChatComposerMetrics.edge)
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
        case .send(let isEnabled): sendButton(look: isEnabled ? .accent : .muted)
        case .stop: stopButton
        case .waiting: sendButton(look: .muted)
        }
    }

    private var toolbar: some View {
        HStack(spacing: ChatComposerMetrics.buttonGap) {
            if let attach { attachButton(attach) }
            if isListening, let voice { ChatVoiceLevel(phase: voice.phase, level: voice.level) }
            Spacer(minLength: 0)
            if let voice { micButton(voice) }
            sendButton
        }
    }

    private func attachButton(_ attach: ChatAttach) -> some View {
        ChatAttachButton(isEnabled: attach.canAdd, action: attach.onAdd)
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
        ChatRoundButton(systemImage: "stop.fill", label: Text("Stop", bundle: .module), look: .quiet) { onStop?() }
    }
}
