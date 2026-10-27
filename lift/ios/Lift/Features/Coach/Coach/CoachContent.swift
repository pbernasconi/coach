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
                CoachIntro(notice: state.notice)
            case .idle: EmptyView()
            case .waiting: ChatTypingIndicator(verbatim: String(localized: "Reading your plan"))
            case .failed(let reason): ChatErrorRow(verbatim: reason) { send(.retryTapped) }
            }
        }
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
                    onStop: { send(.stopTapped) }
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
    let send: (CoachAction) -> Void

    var body: some View {
        switch message.body {
        case .mine(let text):
            ChatMessageBubble(verbatim: text)
        case .coach(let reply):
            VStack(alignment: .leading, spacing: Space.md) {
                // The steps Coach took, as one quiet line; a failed step gets its own line.
                let done = reply.steps.filter { !$0.failed }.map(\.text)
                if !done.isEmpty {
                    ChatToolStatus(verbatim: done.joined(separator: " · "), state: .done)
                }
                ForEach(reply.steps.filter(\.failed)) { ChatToolStatus(verbatim: $0.text, state: .failed) }
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
