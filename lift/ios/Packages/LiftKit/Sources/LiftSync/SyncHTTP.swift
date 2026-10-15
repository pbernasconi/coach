import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// Builds the two requests of SYNC.md. Pure, so tests check paths, headers and bodies without a network.
struct SyncRequestBuilder: Sendable {
    static let pushPath = "api/lift/sync/push"
    static let pullPath = "api/lift/sync/pull"
    static let maxLimit = 500

    let baseURL: URL

    func push(_ body: PushRequest, token: String) throws -> URLRequest {
        var request = URLRequest(url: baseURL.appending(path: Self.pushPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try SyncCoding.encoder().encode(body)
        authorize(&request, token: token)
        return request
    }

    func pull(cursor: String?, limit: Int, token: String) -> URLRequest {
        var items: [URLQueryItem] = []
        if let cursor { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        items.append(URLQueryItem(name: "limit", value: String(min(max(limit, 1), Self.maxLimit))))
        var request = URLRequest(url: baseURL.appending(path: Self.pullPath).appending(queryItems: items))
        request.httpMethod = "GET"
        authorize(&request, token: token)
        return request
    }

    private func authorize(_ request: inout URLRequest, token: String) {
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
    }
}

/// Maps HTTP results to the contract's errors: 401 → unauthorized, 5xx and network → retryable, any other
/// 4xx → rejected, a bad 2xx body → invalidResponse. Cancellation stays `CancellationError` (CONC-7).
enum SyncResponseMapper {
    static func decode<Body: Decodable>(_: Body.Type, from result: (Data, URLResponse)) throws -> Body {
        let (data, response) = result
        guard let http = response as? HTTPURLResponse else { throw SyncTransportError.invalidResponse }
        if let error = SyncTransportError.forStatus(http.statusCode) { throw error }
        do {
            return try SyncCoding.decoder().decode(Body.self, from: data)
        } catch {
            throw SyncTransportError.invalidResponse
        }
    }

    static func transportError(_ error: any Error) -> any Error {
        if error is CancellationError { return error }
        if let urlError = error as? URLError, urlError.code == .cancelled { return CancellationError() }
        return SyncTransportError.retryable(status: nil)
    }
}
