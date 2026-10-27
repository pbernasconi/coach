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
}

/// Talks to Coach: the live server (`LiveCoachChat`, lift/APP-API.md "Coach") or the demo stand-in.
nonisolated protocol CoachChatting: Sendable {
    /// The open conversation, read when the tab opens.
    func thread() async throws -> CoachThread
    /// Coach's reply to `text`, with the conversation before it. Throws `CoachChatError` with words to show.
    func reply(to text: String, after history: [CoachMessage]) async throws -> CoachReply
    /// Applies a proposal's changes to the plan; answers the card's new status (expired when it went stale).
    func apply(_ proposalID: String) async throws -> ChatActionStatus
    /// Takes an applied proposal's changes back; answers the card's new status.
    func undo(_ proposalID: String) async throws -> ChatActionStatus
    /// Dismisses an open proposal; answers the card's new status.
    func dismiss(_ proposalID: String) async throws -> ChatActionStatus
}

/// Why Coach could not answer, in words for the error row.
nonisolated struct CoachChatError: Error, Equatable, Sendable {
    let message: String
}
