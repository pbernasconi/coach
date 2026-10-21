import Foundation
import LiftSync

@testable import Lift

/// An `AppDataSource` with scripted bodies: `kept` answers from `keptBodies`, `fetch` from `results` in order (the last
/// one repeats). Records each fetched path.
@MainActor
final class FakeAppData: AppDataSource {
    var isConnected = true
    var keptBodies: [String: AppAPIKept] = [:]
    var results: [Result<Data, SyncTransportError>]
    /// When each fetch is made.
    var fetchedAt = Date(timeIntervalSince1970: 1_772_456_700)  // 2026-03-02 13:05 UTC
    private(set) var fetched: [String] = []

    init(_ results: [Result<Data, SyncTransportError>] = []) {
        self.results = results
    }

    func kept(_ path: String) async -> AppAPIKept? { keptBodies[path] }

    func fetch(_ path: String, query: [URLQueryItem]) async throws -> AppAPIKept {
        fetched.append(appCacheKey(path, query))
        let result = results.count > 1 ? results.removeFirst() : results.first
        switch result {
        case .success(let data): return AppAPIKept(data: data, fetchedAt: fetchedAt)
        case .failure(let error): throw error
        case nil: throw SyncTransportError.retryable(status: nil)
        }
    }
}
