import Foundation
import KoboComponents

/// One thing Coach did to answer ("Read this week's plan"); shown above its reply. Only real steps.
nonisolated struct CoachChatStep: Identifiable, Equatable, Sendable {
    let id: String
    let text: String
    var failed = false
}

/// Plan changes Coach proposes. Nothing changes until Paolo taps Apply (lift/COACH-CHAT.md).
nonisolated struct CoachProposal: Identifiable, Equatable, Sendable {
    let id: String
    let title: String
    let items: [ChatActionItem]
    var notes: [String] = []
    var status: ChatActionStatus = .pending
    /// The card by day ("The change card"); empty on cards from before 2026-10-29, which show `items`.
    var days: [ChatChangeSection] = []
    /// "5 changes · Fri 30 Oct to Sun 1 Nov".
    var summary: String?
    /// After Apply or Undo: what happened when it isn't simply what the card showed.
    var result: [String] = []
    /// Undo can put back only part (Paolo changed something since): the card asks first.
    var undoConfirm: ChatUndoConfirm?
}

/// What a card action answers: the card's new status, the result lines, and whether Undo asks first.
nonisolated struct CoachProposalUpdate: Equatable, Sendable {
    var status: ChatActionStatus
    var result: [String] = []
    var undoConfirm: ChatUndoConfirm?
}

/// The actions on a change card.
nonisolated enum CoachDecision: Equatable, Sendable {
    case apply
    /// `partial`: Paolo confirmed Undo of only what he hasn't changed since.
    case undo(partial: Bool)
    case dismiss
}

/// Coach's answer to one message: text, the steps it took, and changes to apply, if any.
nonisolated struct CoachReply: Equatable, Sendable {
    let text: String
    var steps: [CoachChatStep] = []
    var proposal: CoachProposal?
    /// Cards with real data under the text (a workout, a week, an exercise, readiness, a day).
    var attachments: [CoachAttachment] = []
    /// One-tap answers when the reply asks a question; a tap sends it.
    var quickReplies: [String] = []
    /// The summary of Coach's thinking, folded above the reply as "Thought"; nil hides the row.
    var thought: String?
    /// Paolo's thumbs on this reply.
    var feedback: ChatFeedbackRating?
    /// Question cards; shown on the latest reply only, while nothing is on its way.
    var questions: [ChatQuestion] = []
}

/// One row of the conversation.
nonisolated struct CoachMessage: Identifiable, Equatable, Sendable {
    enum Body: Equatable, Sendable {
        case mine(String)
        case coach(CoachReply)
    }

    let id: String
    var body: Body
    /// When the server saved it; nil for a row sent from this phone and not read back yet (the transcript shows now).
    var sentAt: Date?
    /// The photos and files on Paolo's message.
    var files: [CoachFile] = []

    /// The proposal this message carries, if any.
    var proposal: CoachProposal? {
        if case .coach(let reply) = body { return reply.proposal }
        return nil
    }
}

/// A photo or file on Paolo's message, as the server keeps it (lift/APP-API.md, "Coach attachments"). Its bytes come
/// from `CoachChatting.fileData`.
nonisolated struct CoachFile: Identifiable, Equatable, Sendable {
    let id: String
    let kind: ChatAttachment.Kind
    let name: String

    /// The tile under the message.
    var attachment: ChatAttachment { ChatAttachment(id: id, kind: kind, name: name) }
}

/// The conversation as the server keeps it: the messages, the quick prompts, and a notice when Coach cannot answer.
nonisolated struct CoachThread: Equatable, Sendable {
    var messages: [CoachMessage] = []
    var prompts: [ChatPrompt] = []
    var notice: String?
    /// Coach is still answering Paolo's last message (it went on while the app was away): the tab polls.
    var answering = false
    /// For the greeting ("Hi Paolo,"); nil says "Hi,".
    var firstName: String?
}

/// A past chat in the history sheet: titled by its first message.
nonisolated struct CoachThreadSummary: Identifiable, Equatable, Sendable {
    let id: String
    let title: String
    let updatedAt: Date?
    let messageCount: Int
}

/// Where a reply stands while it streams in (lift/APP-API.md, "Coach answer stream"): the step, the latest line of
/// Claude's thinking, and the words so far.
nonisolated struct CoachProgress: Equatable, Sendable {
    enum Step: String, Equatable, Sendable {
        case reading, thinking, writing, proposing, card, fixing
    }

    var step = Step.reading
    /// The summary of Claude's thinking so far.
    var thinking = ""
    /// The reply's words so far.
    var text = ""

    /// The quiet status line for the step.
    var label: String {
        switch step {
        case .reading: String(localized: "Reading your week")
        case .thinking: String(localized: "Thinking")
        case .writing: String(localized: "Writing")
        case .proposing: String(localized: "Drafting the change")
        case .card: String(localized: "Getting your data")
        case .fixing: String(localized: "Fixing a clash")
        }
    }

    /// The last sentence of the thinking, short enough for one or two lines under the dots.
    var latestThought: String? {
        let sentences = thinking.split(whereSeparator: { ".!?\n".contains($0) })
        guard let last = sentences.last?.trimmingCharacters(in: .whitespaces), !last.isEmpty else { return nil }
        return last.count > 110 ? String(last.prefix(109)) + "…" : last
    }
}

/// One step of a streamed reply: how far it got, then the reply itself.
nonisolated enum CoachReplyEvent: Equatable, Sendable {
    case progress(CoachProgress)
    case reply(CoachReply)
}

/// Talks to Coach: the live server (`LiveCoachChat`, lift/APP-API.md "Coach") or the demo stand-in.
nonisolated protocol CoachChatting: Sendable {
    /// The open conversation, read when the tab opens.
    func thread() async throws -> CoachThread
    /// Coach's reply to `text`, with the conversation before it. Throws `CoachChatError` with words to show.
    func reply(to text: String, after history: [CoachMessage]) async throws -> CoachReply
    /// The reply as it is made: progress events, then `.reply` last. Throws `CoachChatError`.
    func replies(to text: String, after history: [CoachMessage]) -> AsyncThrowingStream<CoachReplyEvent, any Error>
    /// The reply to a message with photos and files (uploaded first with `upload`). `text` may then be empty.
    func replies(
        to text: String,
        files: [CoachFile],
        after history: [CoachMessage]
    ) -> AsyncThrowingStream<CoachReplyEvent, any Error>
    /// Uploads one photo or file for the next message. Throws `CoachChatError` with words to show.
    func upload(_ file: ChatPickedFile) async throws -> CoachFile
    /// A sent photo's or file's bytes, for its tile.
    func fileData(_ id: String) async throws -> Data
    /// Applies a proposal's changes to the plan; answers the card's new status (expired when it went stale).
    func apply(_ proposalID: String) async throws -> ChatActionStatus
    /// Takes an applied proposal's changes back; answers the card's new status.
    func undo(_ proposalID: String) async throws -> ChatActionStatus
    /// Dismisses an open proposal; answers the card's new status.
    func dismiss(_ proposalID: String) async throws -> ChatActionStatus
    /// Apply, Undo or Dismiss with the full answer (result lines, Undo's question). The default wraps the three above.
    func decide(_ decision: CoachDecision, on proposalID: String) async throws -> CoachProposalUpdate
    /// Paolo's thumbs on one of Coach's replies (nil clears them).
    func rate(_ messageID: String, _ rating: ChatFeedbackRating?) async throws
    /// Past chats, newest first, for the history sheet.
    func threads() async throws -> [CoachThreadSummary]
    /// Starts a new empty chat; it becomes the open one.
    func newThread() async throws -> CoachThread
    /// Opens a past chat again; it becomes the open one and the next message continues it.
    func openThread(_ id: String) async throws -> CoachThread
}

nonisolated extension CoachChatting {
    func decide(_ decision: CoachDecision, on proposalID: String) async throws -> CoachProposalUpdate {
        switch decision {
        case .apply: CoachProposalUpdate(status: try await apply(proposalID))
        case .undo: CoachProposalUpdate(status: try await undo(proposalID))
        case .dismiss: CoachProposalUpdate(status: try await dismiss(proposalID))
        }
    }

    /// A coach that doesn't stream answers in one step.
    func replies(to text: String, after history: [CoachMessage]) -> AsyncThrowingStream<CoachReplyEvent, any Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    continuation.yield(.reply(try await reply(to: text, after: history)))
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// A coach without attachments: the words alone.
    func replies(
        to text: String,
        files: [CoachFile],
        after history: [CoachMessage]
    ) -> AsyncThrowingStream<CoachReplyEvent, any Error> {
        replies(to: text, after: history)
    }

    /// A coach without uploads keeps the file on the phone under its own id.
    func upload(_ file: ChatPickedFile) async throws -> CoachFile {
        CoachFile(id: file.id, kind: file.kind, name: file.name)
    }

    func fileData(_ id: String) async throws -> Data { throw CoachChatError(message: "No such file.") }

    /// A coach without thumbs keeps them on the phone.
    func rate(_ messageID: String, _ rating: ChatFeedbackRating?) async throws {}

    /// A coach without history has only the open chat.
    func threads() async throws -> [CoachThreadSummary] { [] }

    func newThread() async throws -> CoachThread { CoachThread() }

    func openThread(_ id: String) async throws -> CoachThread { try await thread() }
}

/// Why Coach could not answer, in words for the error row.
nonisolated struct CoachChatError: Error, Equatable, Sendable {
    let message: String
}
