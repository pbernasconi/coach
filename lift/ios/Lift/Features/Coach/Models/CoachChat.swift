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

/// Talks to Coach: the live server (`POST /api/app/coach/messages`, lift/COACH-CHAT.md) or the demo stand-in.
nonisolated protocol CoachChatting: Sendable {
    /// Coach's reply to `text`, with the conversation before it.
    func reply(to text: String, after history: [CoachMessage]) async throws -> CoachReply
    /// Applies a proposal's changes to the plan.
    func apply(_ proposalID: String) async throws
    /// Takes an applied proposal's changes back.
    func undo(_ proposalID: String) async throws
}

/// Why Coach could not answer, in words for the error row.
nonisolated struct CoachChatError: Error, Equatable, Sendable {
    let message: String
}
