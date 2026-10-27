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
    /// The exercise pictures of the cards, by URL, as they load.
    var media: [URL: MediaImage] = [:]
    /// The microphone: where listening stands (Kobo's rules), and the input level for the bars.
    var voice = ChatVoiceInput()
    var voiceLevel = 0.0

    /// Starter prompts for an empty conversation (the server's when it sends some); a tap fills the composer.
    var prompts = [
        ChatPrompt(id: "tomorrow", title: "What's on tomorrow?"),
        ChatPrompt(id: "swap", title: "Swap today's lift for an easy run"),
        ChatPrompt(id: "week", title: "How did my week go?"),
        ChatPrompt(id: "sore", title: "I'm sore, make today easy"),
        ChatPrompt(id: "exercise", title: "How do I do a Romanian deadlift?"),
    ]

    /// Whether the composer's button stops a reply rather than sending.
    var isResponding: Bool { phase == .waiting }

    /// The status of a proposal's card.
    func status(of id: String) -> ChatActionStatus? {
        messages.lazy.compactMap(\.proposal).first { $0.id == id }?.status
    }

    mutating func setStatus(_ status: ChatActionStatus, of id: String) {
        for index in messages.indices {
            guard case .coach(var reply) = messages[index].body, reply.proposal?.id == id else { continue }
            reply.proposal?.status = status
            messages[index].body = .coach(reply)
        }
    }

    /// A new proposal replaces the ones still waiting.
    mutating func supersedeOpenProposals() {
        for proposal in messages.compactMap(\.proposal) where proposal.status == .pending {
            setStatus(.superseded, of: proposal.id)
        }
    }

    /// The last thing Paolo wrote, for Retry.
    var lastMessage: String? {
        messages.last { if case .mine = $0.body { true } else { false } }.flatMap {
            if case .mine(let text) = $0.body { text } else { nil }
        }
    }
}
