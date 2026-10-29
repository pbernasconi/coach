import KoboComponents
import KoboTokens
import SwiftUI

/// Paolo's message: the photos and files on it, then the bubble (none for photos sent without words).
struct CoachMineRow: View {
    let text: String
    let files: [CoachFile]
    let previews: [String: Data]
    let send: (CoachAction) -> Void

    var body: some View {
        VStack(alignment: .trailing, spacing: Space.xs) {
            if !files.isEmpty {
                ChatAttachmentStrip(
                    files.map(\.attachment),
                    size: .regular,
                    alignment: .trailing,
                    preview: { CoachPicture.image(previews[$0.id]) }
                )
                .onAppear {
                    for file in files where file.kind == .image && previews[file.id] == nil {
                        send(.filePreviewNeeded(file.id))
                    }
                }
            }
            if !text.isEmpty { ChatMessageBubble(verbatim: text) }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
}

/// One row: Paolo's bubble, or Coach's reply (`CoachReplyRow`).
struct CoachMessageRow: View {
    let message: CoachMessage
    let busyProposal: String?
    let media: [URL: MediaImage]
    let previews: [String: Data]
    /// The latest message, while nothing is on its way: its questions and quick replies show.
    let isLatest: Bool
    let send: (CoachAction) -> Void

    var body: some View {
        switch message.body {
        case .mine(let text):
            CoachMineRow(text: text, files: message.files, previews: previews, send: send)
        case .coach(let reply):
            CoachReplyRow(
                id: message.id,
                reply: reply,
                busyProposal: busyProposal,
                media: media,
                isLatest: isLatest,
                send: send
            )
        }
    }
}

/// Coach's reply: the folded Thought, the steps it took, the text with no bubble, its cards and proposal, the question
/// cards (latest reply only), then the thumbs and copy.
private struct CoachReplyRow: View {
    let id: String
    let reply: CoachReply
    let busyProposal: String?
    let media: [URL: MediaImage]
    let isLatest: Bool
    let send: (CoachAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if let thought = reply.thought {
                ChatThoughtRow(verbatim: thought) { CoachMark(size: Size.iconSm) }
            }
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
            if isLatest, !reply.questions.isEmpty {
                ChatQuestions(reply.questions) { send(.questionsAnswered($0)) }
            } else if isLatest, !reply.quickReplies.isEmpty {
                ChatQuestionCard(
                    ChatQuestion(id: "quick-\(id)", title: "", kind: .single(options: reply.quickReplies))
                ) { answer in
                    if case .choices(let picked) = answer, let first = picked.first { send(.quickReplyTapped(first)) }
                }
            }
            ChatFeedbackRow(rating: reply.feedback, copying: reply.text) {
                send(.feedbackTapped(messageID: id, rating: $0))
            }
        }
    }
}

/// The reply while it streams in: the status line (the latest line of Claude's thinking while it thinks), then the
/// words as they come, with the step under them once Coach drafts a change or fetches a card.
struct CoachLiveReply: View {
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
