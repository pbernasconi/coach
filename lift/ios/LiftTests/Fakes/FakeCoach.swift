import Foundation
import KoboComponents

@testable import Lift

/// A coach that answers at once with a set reply, or fails; it records the card actions.
actor FakeCoach: CoachChatting {
    var reply: Result<CoachReply, CoachChatError>
    var loaded = CoachThread()
    private(set) var actions: [String] = []
    var failsApply = false
    var applyAnswer = ChatActionStatus.applied

    /// When set, `replies` passes on these events (the test feeds them); otherwise it answers the set reply at once.
    nonisolated let feed: AsyncThrowingStream<CoachReplyEvent, any Error>?

    init(_ reply: Result<CoachReply, CoachChatError>, feed: AsyncThrowingStream<CoachReplyEvent, any Error>? = nil) {
        self.reply = reply
        self.feed = feed
    }

    /// Threads to answer first, in order (a conversation still being answered, then answered); then `loaded`.
    var queued: [CoachThread] = []
    private(set) var threadReads = 0

    func thread() async throws -> CoachThread {
        threadReads += 1
        return queued.isEmpty ? loaded : queued.removeFirst()
    }

    func reply(to text: String, after history: [CoachMessage]) async throws -> CoachReply { try reply.get() }

    nonisolated func replies(to text: String, after history: [CoachMessage])
        -> AsyncThrowingStream<CoachReplyEvent, any Error>
    {
        if let feed { return feed }
        return AsyncThrowingStream { continuation in
            Task {
                let answer = await self.reply
                continuation.yield(with: answer.map { .reply($0) }.mapError { $0 as any Error })
                continuation.finish()
            }
        }
    }

    func apply(_ proposalID: String) async throws -> ChatActionStatus {
        if failsApply { throw CoachChatError(message: "no") }
        actions.append("apply \(proposalID)")
        return applyAnswer
    }

    func undo(_ proposalID: String) async throws -> ChatActionStatus {
        actions.append("undo \(proposalID)")
        return .undone
    }

    func dismiss(_ proposalID: String) async throws -> ChatActionStatus {
        actions.append("dismiss \(proposalID)")
        return .dismissed
    }

    func setReply(_ new: Result<CoachReply, CoachChatError>) { reply = new }
    func setFailsApply() { failsApply = true }
    func setApplyAnswer(_ status: ChatActionStatus) { applyAnswer = status }
    func setThread(_ thread: CoachThread) { loaded = thread }
    func queue(_ threads: [CoachThread]) { queued = threads }
}
