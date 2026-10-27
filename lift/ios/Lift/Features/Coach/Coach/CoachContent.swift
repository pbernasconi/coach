import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Dumb view: the conversation, the reply in progress, and the composer (SCR-2).
struct CoachContent: View {
    let state: CoachState
    let send: (CoachAction) -> Void
    @FocusState private var isComposing: Bool

    var body: some View {
        ChatTranscript(state.messages) { message in
            CoachMessageRow(
                message: message,
                busyProposal: state.busyProposal,
                media: state.media,
                showsQuickReplies: message.id == state.messages.last?.id && state.phase == .idle,
                send: send
            )
        } footer: {
            switch state.phase {
            case .idle where state.messages.isEmpty:
                // In the scroll content, so the keyboard scrolls it instead of pushing it under the title.
                CoachIntro(notice: state.notice)
            case .idle: EmptyView()
            case .waiting: ChatTypingIndicator(verbatim: String(localized: "Reading your week"))
            case .answering(let progress): CoachLiveReply(progress: progress)
            case .failed(let reason): ChatErrorRow(verbatim: reason) { send(.retryTapped) }
            }
        }
        .onTranscriptTap { isComposing = false }
        .safeAreaBar(edge: .bottom) {
            VStack(spacing: 0) {
                if state.messages.isEmpty, state.phase == .idle {
                    // At most three starters, in one row docked above the field; a tap fills it.
                    ChatPromptSuggestions(Array(state.prompts.prefix(3))) { prompt in
                        send(.promptPicked(prompt))
                        isComposing = true
                    }
                }
                ChatComposer(
                    text: .action(state.draft) { send(.draftChanged($0)) },
                    prompt: "Message Coach",
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
                    )
                )
                .focused(by: $isComposing)
            }
        }
        .screenCanvas()
        .navigationTitle("Coach")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One row: Paolo's bubble, or Coach's steps, reply and proposal card.
private struct CoachMessageRow: View {
    let message: CoachMessage
    let busyProposal: String?
    let media: [URL: MediaImage]
    /// Quick replies show only under the latest reply, while nothing is on its way.
    let showsQuickReplies: Bool
    let send: (CoachAction) -> Void

    var body: some View {
        switch message.body {
        case .mine(let text):
            ChatMessageBubble(verbatim: text)
        case .coach(let reply):
            VStack(alignment: .leading, spacing: Space.md) {
                if !reply.steps.isEmpty {
                    VStack(alignment: .leading, spacing: Space.xs) {
                        ForEach(reply.steps) { ChatToolStatus(verbatim: $0.text, state: $0.failed ? .failed : .done) }
                    }
                }
                ChatReply(verbatim: reply.text)
                ForEach(Array(reply.attachments.enumerated()), id: \.offset) { _, attachment in
                    CoachAttachmentView(attachment: attachment, media: media, send: send)
                }
                if let proposal = reply.proposal {
                    ChatActionCard(
                        verbatim: proposal.title,
                        items: proposal.items,
                        notes: proposal.notes,
                        status: proposal.status,
                        onApply: { send(.applyTapped(proposalID: proposal.id)) },
                        onDismiss: { send(.dismissTapped(proposalID: proposal.id)) },
                        onUndo: busyProposal == nil ? { send(.undoTapped(proposalID: proposal.id)) } : nil
                    )
                }
                if showsQuickReplies, !reply.quickReplies.isEmpty {
                    ChatPromptSuggestions(reply.quickReplies.map { ChatPrompt(id: $0, title: $0) }) {
                        send(.quickReplyTapped($0.title))
                    }
                    .padding(.horizontal, -Space.gutter)  // the row pays the page gutter itself
                }
            }
        }
    }
}

/// The reply while it streams in: the status line (the latest line of Claude's thinking while it thinks), then the
/// words as they come, with the step under them once Coach drafts a change or fetches a card.
private struct CoachLiveReply: View {
    let progress: CoachProgress

    var body: some View {
        if progress.text.isEmpty {
            ChatTypingIndicator(verbatim: status)
        } else {
            VStack(alignment: .leading, spacing: Space.md) {
                ChatReply(verbatim: progress.text, isStreaming: true)
                if progress.step != .writing { ChatTypingIndicator(verbatim: progress.label) }
            }
        }
    }

    private var status: String {
        progress.step == .thinking ? (progress.latestThought ?? progress.label) : progress.label
    }
}

/// The empty conversation: one line, and the notice (why Coach cannot answer, or the demo) as a quiet caption. The
/// starter prompts sit above the composer.
private struct CoachIntro: View {
    @Environment(\.koboTheme) private var theme
    let notice: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text("What changed today?")
                .font(theme.font(.title2).weight(.regular))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            if let notice {
                Text(verbatim: notice)
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
