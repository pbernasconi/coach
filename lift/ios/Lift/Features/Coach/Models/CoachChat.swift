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
}

/// One row of the conversation.
nonisolated struct CoachMessage: Identifiable, Equatable, Sendable {
    enum Body: Equatable, Sendable {
        case mine(String)
        case coach(CoachReply)
    }

    let id: String
    var body: Body

    /// The proposal this message carries, if any.
    var proposal: CoachProposal? {
        if case .coach(let reply) = body { return reply.proposal }
        return nil
    }
}

/// The conversation as the server keeps it: the messages, the quick prompts, and a notice when Coach cannot answer.
nonisolated struct CoachThread: Equatable, Sendable {
    var messages: [CoachMessage] = []
    var prompts: [ChatPrompt] = []
    var notice: String?
    /// Coach is still answering Paolo's last message (it went on while the app was away): the tab polls.
    var answering = false
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
    /// Applies a proposal's changes to the plan; answers the card's new status (expired when it went stale).
    func apply(_ proposalID: String) async throws -> ChatActionStatus
    /// Takes an applied proposal's changes back; answers the card's new status.
    func undo(_ proposalID: String) async throws -> ChatActionStatus
    /// Dismisses an open proposal; answers the card's new status.
    func dismiss(_ proposalID: String) async throws -> ChatActionStatus
}

extension CoachChatting {
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
}

/// Why Coach could not answer, in words for the error row.
nonisolated struct CoachChatError: Error, Equatable, Sendable {
    let message: String
}
