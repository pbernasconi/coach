import Foundation
import LiftCore

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// `GET /api/app/…` (lift/APP-API.md): the read-only pages of the coach web app. `URLSessionAppAPIClient` is the live
/// one; tests use a fake. A response is returned as its raw body, so the cache can keep it as it came.
public protocol AppAPIFetching: Sendable {
    /// The body of `path` ("api/app/today"), with `tz` and `query` added. Throws `SyncTransportError`: `missingToken`
    /// when no token is stored (nothing was sent), `unauthorized` for 401, `rejected(status:)` for 400 and 404,
    /// `retryable` for 5xx and network errors; or `CancellationError`.
    func get(_ path: String, query: [URLQueryItem]) async throws -> Data
}

extension AppAPIFetching {
    public func get(_ path: String) async throws -> Data {
        try await get(path, query: [])
    }
}

/// The live client: an injected `URLSession` (never `.shared`), the coach web app's origin, the sync token and the
/// person's time zone, which decides "today" on the server.
public struct URLSessionAppAPIClient: AppAPIFetching {
    private let session: URLSession
    private let baseURL: URL
    private let tokens: any TokenProvider
    private let timeZone: @Sendable () -> String

    /// `timeZone` is read for each request, so "today" follows the device when the person travels.
    public init(
        session: URLSession,
        baseURL: URL,
        tokens: any TokenProvider,
        timeZone: @escaping @Sendable () -> String
    ) {
        self.session = session
        self.baseURL = baseURL
        self.tokens = tokens
        self.timeZone = timeZone
    }

    /// Runs off the caller's actor.
    @concurrent
    public func get(_ path: String, query: [URLQueryItem]) async throws -> Data {
        guard let token = try await tokens.token(), !token.isEmpty else { throw SyncTransportError.missingToken }
        let request = AppAPIRequest.make(
            baseURL: baseURL,
            path: path,
            query: query,
            timeZone: timeZone(),
            token: token
        )
        let result: (Data, URLResponse)
        do {
            result = try await session.data(for: request)
        } catch {
            throw SyncResponseMapper.transportError(error)
        }
        guard let http = result.1 as? HTTPURLResponse else { throw SyncTransportError.invalidResponse }
        if let error = SyncTransportError.forStatus(http.statusCode) { throw error }
        return result.0
    }
}

/// Builds an App API request. Pure, so tests check the URL and headers without a network.
public enum AppAPIRequest {
    /// `path` is relative to the origin ("api/app/lift/sessions/latest") and already percent-encoded: a segment such as
    /// "name-push%2Fpull" goes out as it is. (`URL.appending(path:)` would encode its "%" again, to "%252F".)
    public static func make(baseURL: URL, path: String, query: [URLQueryItem], timeZone: String, token: String)
        -> URLRequest
    {
        let items = query + [URLQueryItem(name: "tz", value: timeZone)]
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) ?? URLComponents()
        let base =
            components.percentEncodedPath.hasSuffix("/")
            ? String(components.percentEncodedPath.dropLast()) : components.percentEncodedPath
        components.percentEncodedPath = base + "/" + path
        components.queryItems = items
        // URLComponents leaves "+" as is, and the server reads it as a space ("Etc/GMT+8").
        components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        var request = URLRequest(url: components.url ?? baseURL.appending(path: path).appending(queryItems: items))
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        return request
    }
}
