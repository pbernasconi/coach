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
            prompts: (wire.suggestions ?? []).map { ChatPrompt(id: $0, title: $0) },
            notice: wire.ready == false ? (wire.notice ?? "Coach cannot answer right now.") : wire.notice,
            answering: wire.answering ?? false
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
                    quickReplies: wire.quickReplies ?? []
                )
            )
        return CoachMessage(
            id: wire.id, body: body, sentAt: wire.createdAt.flatMap(date), files: (wire.files ?? []).map(file))
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
