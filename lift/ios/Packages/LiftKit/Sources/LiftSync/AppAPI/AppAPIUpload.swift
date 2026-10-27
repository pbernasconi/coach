import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// An App API client that can send a file as the request body (lift/APP-API.md, "Coach attachments").
public protocol AppAPIUploading: Sendable {
    /// POSTs `body` to `path` with its `contentType` and extra `headers`, and returns the answer's body. Throws the same
    /// `SyncTransportError`s as `send` (413 and 415 are `rejected(status:)`).
    func upload(_ path: String, body: Data, contentType: String, headers: [String: String]) async throws -> Data
}

extension URLSessionAppAPIClient: AppAPIUploading {
    /// Runs off the caller's actor.
    @concurrent
    public func upload(
        _ path: String,
        body: Data,
        contentType: String,
        headers: [String: String]
    ) async throws -> Data {
        var request = try await streamRequest("POST", path, body: body)
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        for (field, value) in headers { request.setValue(value, forHTTPHeaderField: field) }
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
