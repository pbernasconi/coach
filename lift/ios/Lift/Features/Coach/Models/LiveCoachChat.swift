import Foundation
import KoboComponents
import LiftSync

/// The server coach (lift/APP-API.md, "Coach") over the App API client, with the sync token. A reply can take 30 s,
/// so this client's session waits up to 60 s (`CompositionRoot.makeCoachChat`).
nonisolated struct LiveCoachChat: CoachChatting {
    let client: any AppAPIFetching
    private static let decoder = JSONDecoder()

    func thread() async throws -> CoachThread {
        do {
            let data = try await client.get("api/app/coach")
            return CoachWire.thread(try Self.decoder.decode(CoachWire.Thread.self, from: data))
        } catch let error as SyncTransportError {
            throw CoachChatError(message: Self.words(for: error))
        }
    }

    func reply(to text: String, after history: [CoachMessage]) async throws -> CoachReply {
        do {
            let body = try JSONEncoder().encode(["text": text])
            let data = try await client.send("POST", "api/app/coach/messages", body: body)
            let exchange = try Self.decoder.decode(CoachWire.Exchange.self, from: data)
            guard case .coach(let reply) = CoachWire.message(exchange.reply).body else {
                throw CoachChatError(message: Self.words(for: .invalidResponse))
            }
            return reply
        } catch let error as SyncTransportError {
            throw CoachChatError(message: Self.words(for: error))
        } catch is DecodingError {
            throw CoachChatError(message: Self.words(for: .invalidResponse))
        }
    }

    func apply(_ proposalID: String) async throws -> ChatActionStatus { try await act("apply", on: proposalID) }

    func undo(_ proposalID: String) async throws -> ChatActionStatus { try await act("undo", on: proposalID) }

    func dismiss(_ proposalID: String) async throws -> ChatActionStatus { try await act("dismiss", on: proposalID) }

    /// One card action. A 409 (the card is no longer open, or went stale) reads the thread again for its status.
    private func act(_ action: String, on proposalID: String) async throws -> ChatActionStatus {
        let id = proposalID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? proposalID
        do {
            let data = try await client.send("POST", "api/app/coach/proposals/\(id)/\(action)", body: Data("{}".utf8))
            return CoachWire.status(try Self.decoder.decode(CoachWire.ProposalAnswer.self, from: data).proposal.status)
        } catch SyncTransportError.rejected(status: 409) {
            let card = try await thread().messages.compactMap(\.proposal).first { $0.id == proposalID }
            return card?.status ?? .expired
        }
    }

    /// Words for the error row.
    static func words(for error: SyncTransportError) -> String {
        switch error {
        case .missingToken, .unauthorized: "Coach is not connected. Pair this iPhone with Coach in Settings."
        case .rejected: "Coach could not take that message."
        case .invalidResponse: "Coach sent something this app cannot read."
        case .retryable: "Coach could not answer. Check your connection and try again."
        }
    }
}
