import Foundation
import KoboComponents

/// Where Coach's next reply stands.
nonisolated enum CoachReplyPhase: Equatable, Sendable {
    case idle
    case waiting
    /// The reply is streaming in: its step, thinking and words so far.
    case answering(CoachProgress)
    /// The last message got no reply; the error row offers Retry.
    case failed(String)
}

/// The history sheet: closed, loading, its past chats, or why they could not load.
nonisolated enum CoachHistory: Equatable, Sendable {
    case closed
    case loading
    case loaded([CoachThreadSummary])
    case failed(String)

    var isOpen: Bool { self != .closed }
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
    /// The photos and files on the next message, as the composer shows them (lift/COACH-CHAT.md, "Attachments").
    var attachments: [ChatAttachment] = []
    /// Each attachment's stored file once it has uploaded, by attachment id.
    var uploaded: [String: CoachFile] = [:]
    /// Small JPEGs for the tiles: a picked photo's by attachment id, a sent one's by file id once loaded.
    var previews: [String: Data] = [:]
    /// The attach sheet is up.
    var isAttaching = false
    /// For the greeting of an empty chat ("Hi Paolo,").
    var firstName: String?
    var history = CoachHistory.closed

    /// Photos and files one message takes.
    static let attachmentLimit = 6

    /// Starter cards for an empty conversation (the server's when it sends some); a tap fills the composer.
    var prompts = [
        ChatPrompt(id: "tomorrow", title: "What's on tomorrow?", systemImage: "calendar"),
        ChatPrompt(id: "swap", title: "Swap today's lift for an easy run", systemImage: "arrow.triangle.swap"),
        ChatPrompt(id: "week", title: "How did my week go?", systemImage: "chart.bar"),
        ChatPrompt(id: "sore", title: "I'm sore, make today easy", systemImage: "bandage"),
        ChatPrompt(id: "exercise", title: "How do I do a Romanian deadlift?", systemImage: "figure.strengthtraining.traditional"),
    ]

    /// The greeting's first line.
    var greeting: String {
        firstName.map { String(localized: "Hi \($0),") } ?? String(localized: "Hi,")
    }

    /// The question cards to show: the latest message's, when it is Coach's and nothing is on its way.
    var openQuestions: [ChatQuestion] {
        guard phase == .idle, case .coach(let reply)? = messages.last?.body else { return [] }
        return reply.questions
    }

    mutating func setFeedback(_ rating: ChatFeedbackRating?, of messageID: String) {
        guard let index = messages.firstIndex(where: { $0.id == messageID }),
            case .coach(var reply) = messages[index].body
        else { return }
        reply.feedback = rating
        messages[index].body = .coach(reply)
    }

    func feedback(of messageID: String) -> ChatFeedbackRating? {
        guard case .coach(let reply)? = messages.first(where: { $0.id == messageID })?.body else { return nil }
        return reply.feedback
    }

    /// Whether the composer's button stops a reply rather than sending.
    var isResponding: Bool {
        switch phase {
        case .waiting, .answering: true
        case .idle, .failed: false
        }
    }

    /// Whether the message can go: words or attachments, and every attachment uploaded.
    var canSend: Bool {
        guard attachments.allSatisfy({ $0.state == .ready }) else { return false }
        return !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachments.isEmpty
    }

    mutating func setAttachment(_ id: String, _ state: ChatAttachment.State) {
        guard let index = attachments.firstIndex(where: { $0.id == id }) else { return }
        attachments[index].state = state
    }

    /// The status of a proposal's card.
    func status(of id: String) -> ChatActionStatus? {
        messages.lazy.compactMap(\.proposal).first { $0.id == id }?.status
    }

    /// A card action's answer: the status, the result lines and Undo's question.
    mutating func update(_ update: CoachProposalUpdate, of id: String) {
        for index in messages.indices {
            guard case .coach(var reply) = messages[index].body, reply.proposal?.id == id else { continue }
            reply.proposal?.status = update.status
            reply.proposal?.result = update.result
            reply.proposal?.undoConfirm = update.undoConfirm
            messages[index].body = .coach(reply)
        }
    }

    mutating func setStatus(_ status: ChatActionStatus, of id: String) {
        for index in messages.indices {
            guard case .coach(var reply) = messages[index].body, reply.proposal?.id == id else { continue }
            reply.proposal?.status = status
            messages[index].body = .coach(reply)
        }
    }

    /// A row of the conversation, with the next local id.
    mutating func append(_ body: CoachMessage.Body, files: [CoachFile] = []) {
        messages.append(CoachMessage(id: "local-\(nextID)", body: body, files: files))
        nextID += 1
    }

    /// Coach's reply arrived: it ends the wait, and its card replaces the ones still open.
    mutating func receive(_ reply: CoachReply) {
        if reply.proposal != nil { supersedeOpenProposals() }
        append(.coach(reply))
        phase = .idle
    }

    /// A new proposal replaces the ones still waiting.
    mutating func supersedeOpenProposals() {
        for proposal in messages.compactMap(\.proposal) where proposal.status == .pending {
            setStatus(.superseded, of: proposal.id)
        }
    }

    /// The last message Paolo sent, words and files, for Retry. A message of photos alone has no words, so Retry
    /// sends its files again rather than an empty message the server turns down.
    var lastSent: (text: String, files: [CoachFile])? {
        for message in messages.reversed() {
            if case .mine(let text) = message.body { return (text, message.files) }
        }
        return nil
    }
}
