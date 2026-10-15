import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// The live `SyncTransport` (NET-1): an injected `URLSession`, the server's base URL and a token provider.
/// No retries here (NET-2): a failed push keeps its outbox entries and the next sync sends them again.
public struct URLSessionSyncTransport: SyncTransport {
    private let session: URLSession
    private let requests: SyncRequestBuilder
    private let tokens: any TokenProvider

    /// `baseURL` is the coach web app's origin, for example `https://coach.example.com`.
    public init(session: URLSession, baseURL: URL, tokens: any TokenProvider) {
        self.session = session
        self.requests = SyncRequestBuilder(baseURL: baseURL)
        self.tokens = tokens
    }

    public func push(_ body: PushRequest) async throws -> PushResponse {
        let request = try requests.push(body, token: try await bearer())
        return try SyncResponseMapper.decode(PushResponse.self, from: try await send(request))
    }

    public func pull(cursor: String?, limit: Int) async throws -> PullResponse {
        let request = requests.pull(cursor: cursor, limit: limit, token: try await bearer())
        return try SyncResponseMapper.decode(PullResponse.self, from: try await send(request))
    }

    private func bearer() async throws -> String {
        guard let token = try await tokens.token(), !token.isEmpty else { throw SyncTransportError.missingToken }
        return token
    }

    private func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw SyncResponseMapper.transportError(error)
        }
    }
}
