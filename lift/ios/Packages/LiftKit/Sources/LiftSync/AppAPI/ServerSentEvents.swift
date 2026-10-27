import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// One Server-Sent Event: its name (`event:`) and its `data:` text.
public struct ServerSentEvent: Equatable, Sendable {
    public let event: String
    public let data: String

    public init(event: String, data: String) {
        self.event = event
        self.data = data
    }
}

/// Reads a Server-Sent Events stream line by line. Each `data:` line is one event, named by the `event:` line before
/// it (the coach server sends one data line per event). Comments (`:`) and blank lines are skipped, so a line reader
/// that drops blank lines still works. Pure.
public struct ServerSentEventParser: Sendable {
    private var name: String?

    public init() {}

    /// The event this line completes, if any.
    public mutating func read(_ line: String) -> ServerSentEvent? {
        if line.hasPrefix("event:") {
            name = Self.value(of: line, after: "event:")
            return nil
        }
        guard line.hasPrefix("data:") else {
            if line.isEmpty { name = nil }
            return nil
        }
        defer { name = nil }
        return ServerSentEvent(event: name ?? "message", data: Self.value(of: line, after: "data:"))
    }

    private static func value(of line: String, after field: String) -> String {
        let rest = line.dropFirst(field.count)
        return String(rest.hasPrefix(" ") ? rest.dropFirst() : rest)
    }
}

/// An App API client that can read a streamed answer (lift/APP-API.md, "Coach answer stream").
public protocol AppAPIStreaming: Sendable {
    /// Sends `body` (JSON) to `path` with `Accept: text/event-stream` and yields the events as they come. Throws the
    /// same `SyncTransportError`s as `send` for a refused request.
    func stream(_ method: String, _ path: String, body: Data) -> AsyncThrowingStream<ServerSentEvent, any Error>
}

#if !canImport(FoundationNetworking)
    extension URLSessionAppAPIClient: AppAPIStreaming {
        public func stream(_ method: String, _ path: String, body: Data)
            -> AsyncThrowingStream<ServerSentEvent, any Error>
        {
            AsyncThrowingStream { continuation in
                let task = Task {
                    do {
                        try await read(method, path, body: body) { continuation.yield($0) }
                        continuation.finish()
                    } catch {
                        continuation.finish(throwing: error)
                    }
                }
                continuation.onTermination = { _ in task.cancel() }
            }
        }

        @concurrent
        private func read(
            _ method: String,
            _ path: String,
            body: Data,
            yield: @Sendable (ServerSentEvent) -> Void
        ) async throws {
            var request = try await streamRequest(method, path, body: body)
            request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
            let bytes: URLSession.AsyncBytes
            let response: URLResponse
            do {
                (bytes, response) = try await session.bytes(for: request)
            } catch {
                throw SyncResponseMapper.transportError(error)
            }
            guard let http = response as? HTTPURLResponse else { throw SyncTransportError.invalidResponse }
            if let error = SyncTransportError.forStatus(http.statusCode) { throw error }
            var parser = ServerSentEventParser()
            do {
                for try await line in bytes.lines {
                    if let event = parser.read(line) { yield(event) }
                }
            } catch {
                throw SyncResponseMapper.transportError(error)
            }
        }
    }
#endif
