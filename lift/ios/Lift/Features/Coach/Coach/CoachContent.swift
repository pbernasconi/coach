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
            CoachMessageRow(message: message, busyProposal: state.busyProposal, send: send)
        } footer: {
            switch state.phase {
            case .idle where state.messages.isEmpty:
                // In the scroll content, so the keyboard scrolls it instead of pushing it under the title.
                CoachIntro(prompts: state.prompts, notice: state.notice) { prompt in
                    send(.promptPicked(prompt))
                    isComposing = true
                }
            case .idle: EmptyView()
            case .waiting: ChatTypingIndicator(verbatim: String(localized: "Reading your plan"))
            case .failed(let reason): ChatErrorRow(verbatim: reason) { send(.retryTapped) }
            }
        }
        .safeAreaBar(edge: .bottom) {
            ChatComposer(
                text: .action(state.draft) { send(.draftChanged($0)) },
                prompt: "Message Coach",
                isResponding: state.isResponding,
                onSend: { send(.sendTapped) },
                onStop: { send(.stopTapped) }
            )
            .focused(by: $isComposing)
        }
        .screenCanvas()
        .tabRootHeader { AppHeader("Coach") }
    }
}

/// One row: Paolo's bubble, or Coach's steps, reply and proposal card.
private struct CoachMessageRow: View {
    let message: CoachMessage
    let busyProposal: String?
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
            }
        }
    }
}

/// The empty conversation: what Coach does, the notice (why Coach cannot answer, or the demo), and starter prompts.
private struct CoachIntro: View {
    @Environment(\.koboTheme) private var theme
    let prompts: [ChatPrompt]
    let notice: String?
    let onSelect: (ChatPrompt) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            VStack(alignment: .leading, spacing: Space.xs) {
                Text("Change the plan in plain words")
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                Text(
                    "Tell Coach what changed: your calendar, how you feel, who you train with. Coach proposes the changes, and you apply them."
                )
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            }
            if let notice { InlineNotice(verbatim: notice, tone: .info) }
            ChatPromptSuggestions(prompts, onSelect: onSelect)
        }
    }
}
