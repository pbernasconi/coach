import Foundation
import KoboComponents

/// The Coach routes' JSON (lift/APP-API.md, "Coach") and how it maps to the tab's models. Pure, so tests decode the
/// contract's examples without a network.
nonisolated enum CoachWire {
    struct Thread: Decodable, Sendable {
        let messages: [Message]
        let ready: Bool?
        let notice: String?
        let suggestions: [String]?
        /// Missing in older servers: false.
        let answering: Bool?
        /// The starter cards of an empty chat; missing in older servers (then `suggestions`).
        let prompts: [Prompt]?
        let firstName: String?
    }

    struct Prompt: Decodable, Sendable {
        let title: String
        let symbol: String?
    }

    /// `GET /api/app/coach/threads`.
    struct Threads: Decodable, Sendable {
        let threads: [ThreadSummary]
    }

    struct ThreadSummary: Decodable, Sendable {
        let id: String
        let title: String?
        let updatedAt: String?
        let messageCount: Int?
    }

    /// A question card (lift/APP-API.md, "Coach"): `kind` single, multi, text or confirm.
    struct Question: Decodable, Sendable {
        let id: String
        let title: String
        let subtitle: String?
        let kind: String
        let options: [String]?
        let allowOther: Bool?
        let placeholder: String?
        let confirm: Confirm?
    }

    struct Confirm: Decodable, Sendable {
        let primary: String
        let secondary: String?
    }

    struct Message: Decodable, Sendable {
        let id: String
        let role: String
        let text: String
        /// ISO 8601, for the chat's time lines; missing or unreadable leaves the row undated.
        let createdAt: String?
        let proposal: Proposal?
        /// The cards in the reply; missing in bodies from before they existed.
        let attachments: Attachments?
        /// One-tap answers when Coach asks a question.
        let quickReplies: [String]?
        /// The photos and files on Paolo's message; missing in bodies from before they existed.
        let files: [File]?
        /// Coach's: the summary of its thinking, its question cards and Paolo's thumbs; missing in older bodies.
        let thought: String?
        let questions: [Question]?
        let feedback: String?
    }

    /// A photo or file on a message (lift/APP-API.md, "Coach attachments").
    struct File: Decodable, Sendable {
        let id: String
        let kind: String
        let name: String
    }

    /// `POST /api/app/coach/files`: the stored upload.
    struct Upload: Decodable, Sendable {
        let file: File
    }

    /// A message's cards, each decoded on its own: one this build cannot read is dropped and the rest stay.
    struct Attachments: Decodable, Sendable {
        let items: [CoachAttachment]

        init(from decoder: any Decoder) throws {
            items = CoachAttachment.list(from: decoder)
        }
    }

    struct Proposal: Decodable, Sendable {
        let id: String
        let title: String
        let items: [Item]
        let warnings: [String]?
        let status: String
    }

    struct Item: Decodable, Sendable {
        let kind: String
        let title: String
        let detail: String?
    }

    /// `POST …/messages`: Paolo's message as saved, and Coach's reply.
    struct Exchange: Decodable, Sendable {
        let reply: Message
    }

    /// `POST …/proposals/{id}/apply|undo|dismiss`.
    struct ProposalAnswer: Decodable, Sendable {
        let proposal: Proposal
    }

    static func thread(_ wire: Thread) -> CoachThread {
        CoachThread(
            messages: wire.messages.map(message),
            prompts: wire.prompts.map { $0.map { ChatPrompt(id: $0.title, title: $0.title, systemImage: $0.symbol) } }
                ?? (wire.suggestions ?? []).map { ChatPrompt(id: $0, title: $0) },
            notice: wire.ready == false ? (wire.notice ?? "Coach cannot answer right now.") : wire.notice,
            answering: wire.answering ?? false,
            firstName: wire.firstName
        )
    }

    static func message(_ wire: Message) -> CoachMessage {
        let body: CoachMessage.Body =
            wire.role == "user"
            ? .mine(wire.text)
            : .coach(
                CoachReply(
                    text: wire.text,
                    proposal: wire.proposal.map(proposal),
                    attachments: wire.attachments?.items ?? [],
                    quickReplies: wire.quickReplies ?? [],
                    thought: wire.thought.flatMap { $0.isEmpty ? nil : $0 },
                    feedback: wire.feedback.flatMap(ChatFeedbackRating.init(rawValue:)),
                    questions: (wire.questions ?? []).compactMap(question)
                )
            )
        return CoachMessage(
            id: wire.id, body: body, sentAt: wire.createdAt.flatMap(date), files: (wire.files ?? []).map(file))
    }

    /// A question card; one of a kind this build does not know is left out.
    static func question(_ wire: Question) -> ChatQuestion? {
        let options = wire.options ?? []
        let kind: ChatQuestion.Kind
        switch wire.kind {
        case "single": kind = .single(options: options, allowsOther: wire.allowOther ?? false)
        case "multi": kind = .multi(options: options, allowsOther: wire.allowOther ?? false)
        case "text": kind = .text(placeholder: wire.placeholder)
        case "confirm":
            guard let confirm = wire.confirm else { return nil }
            kind = .confirm(primary: confirm.primary, secondary: confirm.secondary)
        default: return nil
        }
        return ChatQuestion(id: wire.id, title: wire.title, subtitle: wire.subtitle, kind: kind)
    }

    static func summary(_ wire: ThreadSummary) -> CoachThreadSummary {
        CoachThreadSummary(
            id: wire.id,
            title: wire.title ?? String(localized: "New chat"),
            updatedAt: wire.updatedAt.flatMap(date),
            messageCount: wire.messageCount ?? 0
        )
    }

    /// The server's timestamps, with or without fractional seconds.
    static func date(_ text: String) -> Date? {
        (try? Date(text, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)))
            ?? (try? Date(text, strategy: .iso8601))
    }

    /// A photo is a picture tile; a PDF or a text file a page tile.
    static func file(_ wire: File) -> CoachFile {
        CoachFile(id: wire.id, kind: wire.kind == "image" ? .image : .file, name: wire.name)
    }

    static func proposal(_ wire: Proposal) -> CoachProposal {
        CoachProposal(
            id: wire.id,
            title: wire.title,
            items: wire.items.enumerated().map { item($0.element, index: $0.offset) },
            notes: wire.warnings ?? [],
            status: status(wire.status)
        )
    }

    /// A row: "changed" with "old → new" shows the old value struck through; without an arrow it is an edit.
    static func item(_ wire: Item, index: Int) -> ChatActionItem {
        let parts = wire.detail?.components(separatedBy: " → ") ?? []
        let split = parts.count == 2
        let change: ChatActionItem.Change =
            switch wire.kind {
            case "added": .add
            case "removed": .remove
            default: split ? .move : .edit
            }
        return ChatActionItem(
            id: "\(index)",
            change: change,
            title: wire.title,
            detail: split ? parts[1] : wire.detail,
            previous: split ? parts[0] : nil
        )
    }

    /// The card's state: open → pending, stale → expired; an unknown status reads as expired (no buttons).
    static func status(_ wire: String) -> ChatActionStatus {
        switch wire {
        case "open": .pending
        case "applied": .applied
        case "undone": .undone
        case "dismissed": .dismissed
        default: .expired
        }
    }
}
