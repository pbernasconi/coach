import Foundation
import KoboComponents

/// Where Coach's next reply stands.
nonisolated enum CoachReplyPhase: Equatable, Sendable {
    case idle
    case waiting
    /// The last message got no reply; the error row offers Retry.
    case failed(String)
}

/// The Coach tab: the conversation, the draft and the reply in progress.
nonisolated struct CoachState: Equatable, Sendable {
    var messages: [CoachMessage] = []
    var draft = ""
    var phase = CoachReplyPhase.idle
    /// The proposal being applied or undone, so its card shows the spinner.
    var busyProposal: String?
    /// The next local message id ("local-0"…): ids stay stable without a clock or random numbers.
    var nextID = 0
    /// Why Coach cannot answer, or what this build is (the demo); shown over the starter prompts.
    var notice: String?

    /// Starter prompts for an empty conversation (the server's when it sends some); a tap fills the composer.
    var prompts = [
        ChatPrompt(id: "swap", title: "Swap today's lift for an easy run", systemImage: "arrow.left.arrow.right"),
        ChatPrompt(id: "move", title: "Move today's session to tomorrow", systemImage: "arrow.right"),
        ChatPrompt(id: "sore", title: "I'm sore, make today easy", systemImage: "bandage"),
        ChatPrompt(id: "short", title: "I only have 30 minutes", systemImage: "clock"),
        ChatPrompt(id: "week", title: "How did my week go?", systemImage: "calendar"),
    ]

    /// Whether the composer's button stops a reply rather than sending.
    var isResponding: Bool { phase == .waiting }

    /// The last thing Paolo wrote, for Retry.
    var lastMessage: String? {
        messages.last { if case .mine = $0.body { true } else { false } }.flatMap {
            if case .mine(let text) = $0.body { text } else { nil }
        }
    }
}
