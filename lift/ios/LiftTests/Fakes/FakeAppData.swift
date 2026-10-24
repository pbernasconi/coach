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
    /// Each write: its path and JSON body.
    private(set) var puts: [(path: String, body: Data)] = []
    /// Each delete's path.
    private(set) var deletes: [String] = []
    /// The answer to every write; nil answers with the body sent.
    var putResult: Result<Data, SyncTransportError>?
    /// The paths of the bodies kept with `keep`.
    private(set) var keptPaths: [String] = []

    init(_ results: [Result<Data, SyncTransportError>] = []) {
        self.results = results
    }

    func kept(_ path: String) async -> AppAPIKept? { keptBodies[path] }

    func keep(_ kept: AppAPIKept, for path: String) async {
        keptPaths.append(path)
        keptBodies[path] = kept
    }

    func put(_ path: String, body: Data) async throws -> Data {
        puts.append((path, body))
        switch putResult {
        case .success(let data): return data
        case .failure(let error): throw error
        case nil: return body
        }
    }

    func delete(_ path: String) async throws -> Data {
        deletes.append(path)
        switch putResult {
        case .success(let data): return data
        case .failure(let error): throw error
        case nil: return Data(#"{"removed":true}"#.utf8)
        }
    }

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
