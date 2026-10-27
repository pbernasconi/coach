import Foundation
import KoboComponents
import LiftSync

/// The server coach (lift/APP-API.md, "Coach") over the App API client, with the sync token. The reply streams in
/// (`replies`); the session waits up to 60 s between pieces (`CompositionRoot.makeCoachChat`).
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

    /// The streamed answer when the client can stream, else the JSON one. A stream that ends before `done` throws, so
    /// the tab reads the thread again (the server finishes the answer either way).
    func replies(to text: String, after history: [CoachMessage]) -> AsyncThrowingStream<CoachReplyEvent, any Error> {
        guard let streaming = client as? any AppAPIStreaming else { return oneStep(text, history) }
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    try await Self.read(streaming, text, into: continuation)
                } catch let error as SyncTransportError {
                    continuation.finish(throwing: CoachChatError(message: Self.words(for: error)))
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private static func read(
        _ streaming: any AppAPIStreaming,
        _ text: String,
        into continuation: AsyncThrowingStream<CoachReplyEvent, any Error>.Continuation
    ) async throws {
        let body = try JSONEncoder().encode(["text": text])
        var progress = CoachProgress()
        for try await event in streaming.stream("POST", "api/app/coach/messages", body: body) {
            switch CoachStreamWire.apply(event, to: &progress) {
            case .progress(let now): continuation.yield(.progress(now))
            case .reply(let reply):
                continuation.yield(.reply(reply))
                continuation.finish()
                return
            case .failed(let words): throw CoachChatError(message: words)
            case .ignored: continue
            }
        }
        throw CoachChatError(message: words(for: .retryable))
    }

    private func oneStep(_ text: String, _ history: [CoachMessage]) -> AsyncThrowingStream<CoachReplyEvent, any Error> {
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
