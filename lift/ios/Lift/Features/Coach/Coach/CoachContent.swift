import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI
import UIKit

/// Dumb view: the conversation (or, empty, the greeting and starter cards), the reply in progress, the floating top bar
/// and the composer (SCR-2).
struct CoachContent: View {
    let state: CoachState
    let send: (CoachAction) -> Void
    @FocusState private var isComposing: Bool

    private var isEmpty: Bool { state.messages.isEmpty && state.phase == .idle }

    var body: some View {
        conversation
            .safeAreaBar(edge: .top) { CoachTopBar(send: send) }
            .safeAreaBar(edge: .bottom) {
                CoachComposerBar(state: state, send: send, isComposing: $isComposing, isEmpty: isEmpty)
            }
            .chatAttachPicker(
                isPresented: .action(state.isAttaching) { send(.attachShown($0)) },
                limit: CoachState.attachmentLimit - state.attachments.count
            ) { send(.filesPicked($0)) }
            .koboSheet(
                isPresented: .action(state.history.isOpen) { send(.historyShown($0)) },
                title: "Past chats",
                detents: [.medium, .large]
            ) {
                CoachHistoryList(history: state.history, send: send)
            }
            .modifier(CoachCanvas())
            .toolbarVisibility(.hidden, for: .navigationBar)
    }

    @ViewBuilder
    private var conversation: some View {
        if isEmpty {
            CoachEmptyState(state: state) { prompt in
                send(.promptPicked(prompt))
                isComposing = true
            }
        } else {
            ChatTranscript(state.messages) { message in
                CoachMessageRow(
                    message: message,
                    busyProposal: state.busyProposal,
                    media: state.media,
                    previews: state.previews,
                    isLatest: message.id == state.messages.last?.id && state.phase == .idle,
                    send: send
                )
            } footer: {
                switch state.phase {
                case .idle: EmptyView()
                case .waiting: ChatTypingIndicator(verbatim: String(localized: "Reading your week"))
                case .answering(let progress): CoachLiveReply(progress: progress)
                case .failed(let reason): ChatErrorRow(verbatim: reason) { send(.retryTapped) }
                }
            }
            .timestamps(\.sentAt)
            .onTranscriptTap { isComposing = false }
        }
    }
}

/// The chat's background: white in light mode, black in dark (the grey canvas would hide the grey bubbles). Nothing
/// coloured sits behind the bars, so the tab bar looks as it does on every other tab.
struct CoachCanvas: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme

    static func color(_ palette: Palette, _ scheme: ColorScheme) -> Color {
        scheme == .dark ? palette.canvas : palette.surface
    }

    func body(content: Content) -> some View {
        content.background { Self.color(theme.palette, colorScheme).ignoresSafeArea() }
    }
}

/// The floating top bar: no title, one glass pill at the trailing edge with Settings, past chats and a new chat.
private struct CoachTopBar: View {
    let send: (CoachAction) -> Void

    var body: some View {
        HStack {
            Spacer(minLength: 0)
            ToolbarPill([
                ToolbarPillItem("gearshape", label: "Coaching settings") { send(.settingsTapped) },
                ToolbarPillItem("clock.arrow.circlepath", label: "Past chats") { send(.historyShown(true)) },
                ToolbarPillItem("plus", label: "New chat") { send(.newChatTapped) },
            ])
        }
        .padding(.horizontal, Space.gutter)
        .padding(.bottom, Space.xs)
    }
}

/// The composer with its microphone and +, over a fade of the chat's background once there is a conversation.
private struct CoachComposerBar: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    let state: CoachState
    let send: (CoachAction) -> Void
    var isComposing: FocusState<Bool>.Binding
    let isEmpty: Bool

    var body: some View {
        ChatComposer(
            text: .action(state.draft) { send(.draftChanged($0)) },
            prompt: "Ask anything",
            isResponding: state.isResponding,
            onSend: { send(.sendTapped) },
            onStop: { send(.stopTapped) },
            voice: ChatVoice(
                phase: state.voice.phase,
                level: state.voiceLevel,
                onTap: { send(.micTapped) },
                onHoldBegan: { send(.micHoldBegan) },
                onHoldEnded: { send(.micHoldEnded) },
                onOpenSettings: { send(.voiceSettingsTapped) }
            ),
            attach: ChatAttach(
                items: state.attachments,
                preview: { CoachPicture.image(state.previews[$0.id]) },
                onAdd: { send(.attachShown(true)) },
                onRemove: { send(.attachmentRemoved($0.id)) },
                onRetry: { send(.attachmentRetried($0.id)) },
                canAdd: state.attachments.count < CoachState.attachmentLimit
            )
        )
        .focused(by: isComposing)
        .backdrop(isEmpty ? nil : CoachCanvas.color(theme.palette, colorScheme))
    }
}

/// A tile's picture from its JPEG bytes.
enum CoachPicture {
    static func image(_ data: Data?) -> Image? {
        data.flatMap(UIImage.init(data:)).map(Image.init(uiImage:))
    }
}

/// The empty chat: Coach's mark and the greeting in the upper half, the starter cards under it, and the notice (why
/// Coach cannot answer, or the demo) as a quiet caption. A tap on a card fills the composer.
private struct CoachEmptyState: View {
    @Environment(\.koboTheme) private var theme
    let state: CoachState
    let onPick: (ChatPrompt) -> Void

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(spacing: Space.xxxl) {
                    ChatGreeting(verbatim: state.greeting, String(localized: "How can Coach help?")) {
                        CoachMark(size: Size.iconLg)
                    }
                    VStack(spacing: Space.md) {
                        ChatPromptCards(Array(state.prompts.prefix(3)), onSelect: onPick)
                        if let notice = state.notice {
                            Text(verbatim: notice)
                                .font(theme.font(.caption))
                                .foregroundStyle(theme.palette.textTertiary)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(.top, proxy.size.height * 0.14)
                .pageColumn()
                .frame(minHeight: proxy.size.height, alignment: .top)
            }
            .scrollDismissesKeyboard(.interactively)
            .scrollBounceBehavior(.basedOnSize)
        }
    }
}
