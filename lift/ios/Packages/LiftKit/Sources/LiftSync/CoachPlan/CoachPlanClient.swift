import Foundation
import LiftCore

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// A Week API response: the body as it came (the cache keeps it) and its decoded plan.
public struct CoachPlanResponse: Equatable, Sendable {
    public var data: Data
    public var plan: CoachPlan

    public init(data: Data, plan: CoachPlan) {
        self.data = data
        self.plan = plan
    }

    /// Decodes a body the server sent or the cache kept. Throws `SyncTransportError.invalidResponse` for anything
    /// that is not the contract's shape.
    public init(data: Data) throws {
        do {
            self.init(data: data, plan: try JSONDecoder().decode(CoachPlan.self, from: data))
        } catch {
            throw SyncTransportError.invalidResponse
        }
    }
}

/// `GET /api/lift/week` (lift/WEEK-API.md). `URLSessionCoachPlanClient` is the live one; tests use a fake.
public protocol CoachPlanFetching: Sendable {
    /// The `weeks` weeks from the week of `start`, with "today" in `timeZone` (an IANA id). Throws
    /// `SyncTransportError` (`missingToken` when no token is stored: nothing was sent) or `CancellationError`.
    func weeks(from start: LocalDay, count: Int, timeZone: String) async throws -> CoachPlanResponse
}

/// The live client: an injected `URLSession` (never `.shared`), the coach web app's origin and the sync token.
public struct URLSessionCoachPlanClient: CoachPlanFetching {
    private let session: URLSession
    private let baseURL: URL
    private let tokens: any TokenProvider

    public init(session: URLSession, baseURL: URL, tokens: any TokenProvider) {
        self.session = session
        self.baseURL = baseURL
        self.tokens = tokens
    }

    /// Runs off the caller's actor: the request and the decoding never block the main actor.
    @concurrent
    public func weeks(from start: LocalDay, count: Int, timeZone: String) async throws -> CoachPlanResponse {
        guard let token = try await tokens.token(), !token.isEmpty else { throw SyncTransportError.missingToken }
        let request = CoachPlanRequest.make(
            baseURL: baseURL,
            start: start,
            weeks: count,
            timeZone: timeZone,
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
        return try CoachPlanResponse(data: result.0)
    }
}

/// Builds the Week API request. Pure, so tests check the URL and headers without a network.
public enum CoachPlanRequest {
    static let path = "api/lift/week"
    /// The contract allows 1–4 weeks.
    static let weekRange = 1...4

    public static func make(baseURL: URL, start: LocalDay, weeks: Int, timeZone: String, token: String)
        -> URLRequest
    {
        let items = [
            URLQueryItem(name: "start", value: CoachPlanDates.plain(start)),
            URLQueryItem(name: "weeks", value: String(min(max(weeks, weekRange.lowerBound), weekRange.upperBound))),
            URLQueryItem(name: "tz", value: timeZone),
        ]
        var request = URLRequest(url: baseURL.appending(path: path).appending(queryItems: items))
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        return request
    }
}
