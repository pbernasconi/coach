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
        try await reply(to: text, files: [])
    }

    /// `PUT /api/app/coach/messages/{id}/feedback`.
    func rate(_ messageID: String, _ rating: ChatFeedbackRating?) async throws {
        let id = messageID.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? messageID
        let body = rating.map { #"{"rating":"\#($0.rawValue)"}"# } ?? #"{"rating":null}"#
        do {
            _ = try await client.send("PUT", "api/app/coach/messages/\(id)/feedback", body: Data(body.utf8))
        } catch let error as SyncTransportError {
            throw CoachChatError(message: Self.words(for: error))
        }
    }

    /// `GET /api/app/coach/threads`.
    func threads() async throws -> [CoachThreadSummary] {
        do {
            let data = try await client.get("api/app/coach/threads")
            return try Self.decoder.decode(CoachWire.Threads.self, from: data).threads.map(CoachWire.summary)
        } catch let error as SyncTransportError {
            throw CoachChatError(message: Self.words(for: error))
        } catch is DecodingError {
            throw CoachChatError(message: Self.words(for: .invalidResponse))
        }
    }

    /// `POST /api/app/coach/threads`: a new empty chat.
    func newThread() async throws -> CoachThread { try await postThread("api/app/coach/threads") }

    /// `POST /api/app/coach/threads/{id}`: a past chat becomes the open one.
    func openThread(_ id: String) async throws -> CoachThread {
        try await postThread("api/app/coach/threads/\(id.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? id)")
    }

    private func postThread(_ path: String) async throws -> CoachThread {
        do {
            let data = try await client.send("POST", path, body: Data("{}".utf8))
            return CoachWire.thread(try Self.decoder.decode(CoachWire.Thread.self, from: data))
        } catch let error as SyncTransportError {
            throw CoachChatError(message: Self.words(for: error))
        } catch is DecodingError {
            throw CoachChatError(message: Self.words(for: .invalidResponse))
        }
    }

    /// The message's body: its words and the ids of its uploads (lift/APP-API.md, "Coach").
    private struct Outgoing: Encodable {
        let text: String
        let files: [String]?
    }

    private static func body(_ text: String, _ files: [CoachFile]) throws -> Data {
        try JSONEncoder().encode(Outgoing(text: text, files: files.isEmpty ? nil : files.map(\.id)))
    }

    private func reply(to text: String, files: [CoachFile]) async throws -> CoachReply {
        do {
            let body = try Self.body(text, files)
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
        replies(to: text, files: [], after: history)
    }

    func replies(
        to text: String,
        files: [CoachFile],
        after history: [CoachMessage]
    ) -> AsyncThrowingStream<CoachReplyEvent, any Error> {
        guard let streaming = client as? any AppAPIStreaming else { return oneStep(text, files) }
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    try await Self.read(streaming, try Self.body(text, files), into: continuation)
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
        _ body: Data,
        into continuation: AsyncThrowingStream<CoachReplyEvent, any Error>.Continuation
    ) async throws {
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
        throw CoachChatError(message: Self.words(for: .retryable(status: nil)))
    }

    private func oneStep(_ text: String, _ files: [CoachFile]) -> AsyncThrowingStream<CoachReplyEvent, any Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    continuation.yield(.reply(try await reply(to: text, files: files)))
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// `POST /api/app/coach/files` with the file as the body. A photo is JPEG already (Kobo's picker shrinks it).
    func upload(_ file: ChatPickedFile) async throws -> CoachFile {
        guard let uploading = client as? any AppAPIUploading else {
            throw CoachChatError(message: Self.words(for: .missingToken))
        }
        var headers = ["X-File-Name": file.name.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "file"]
        if let width = file.pixelWidth, let height = file.pixelHeight {
            headers["X-Image-Width"] = String(width)
            headers["X-Image-Height"] = String(height)
        }
        do {
            let data = try await uploading.upload(
                "api/app/coach/files",
                body: file.data,
                contentType: file.contentType,
                headers: headers
            )
            return CoachWire.file(try Self.decoder.decode(CoachWire.Upload.self, from: data).file)
        } catch SyncTransportError.rejected(status: 413) {
            throw CoachChatError(message: "That file is over 4 MB.")
        } catch SyncTransportError.rejected(status: 415) {
            throw CoachChatError(message: "Coach reads photos, PDFs and text files.")
        } catch let error as SyncTransportError {
            throw CoachChatError(message: Self.words(for: error))
        } catch is DecodingError {
            throw CoachChatError(message: Self.words(for: .invalidResponse))
        }
    }

    /// `GET /api/app/coach/files/{id}`.
    func fileData(_ id: String) async throws -> Data {
        let path = id.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? id
        return try await client.get("api/app/coach/files/\(path)")
    }

    func apply(_ proposalID: String) async throws -> ChatActionStatus { try await act("apply", on: proposalID) }

    func undo(_ proposalID: String) async throws -> ChatActionStatus { try await act("undo", on: proposalID) }

    func dismiss(_ proposalID: String) async throws -> ChatActionStatus { try await act("dismiss", on: proposalID) }

    func decide(_ decision: CoachDecision, on proposalID: String) async throws -> CoachProposalUpdate {
        let id = proposalID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? proposalID
        let (action, body): (String, String) =
            switch decision {
            case .apply: ("apply", "{}")
            case .undo(let partial): ("undo", partial ? #"{"partial":true}"# : "{}")
            case .dismiss: ("dismiss", "{}")
            }
        do {
            let data = try await client.send("POST", "api/app/coach/proposals/\(id)/\(action)", body: Data(body.utf8))
            return CoachWire.update(try Self.decoder.decode(CoachWire.ProposalAnswer.self, from: data))
        } catch SyncTransportError.rejected(status: 409) {
            // The card went stale or isn't open: the thread has its status and, on a refused Apply, why.
            let card = try await thread().messages.compactMap(\.proposal).first { $0.id == proposalID }
            return CoachProposalUpdate(status: card?.status ?? .expired, result: card?.result ?? [])
        }
    }

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
