import Foundation
import LiftSync

@testable import Lift

/// An `AppDataSource` that answers by path and query (`appCacheKey`), so screens that load several paths at once get
/// the right body whatever the order. A key without an answer throws `retryable`. Records every key fetched.
@MainActor
final class RoutedAppData: AppDataSource {
    var isConnected = true
    var answers: [String: Result<Data, SyncTransportError>]
    private(set) var fetched: [String] = []

    init(_ answers: [String: Result<Data, SyncTransportError>]) {
        self.answers = answers
    }

    func kept(_: String) async -> AppAPIKept? { nil }

    func fetch(_ path: String, query: [URLQueryItem]) async throws -> AppAPIKept {
        let key = appCacheKey(path, query)
        fetched.append(key)
        switch answers[key] {
        case .success(let data): return AppAPIKept(data: data, fetchedAt: Date(timeIntervalSince1970: 1_772_456_700))
        case .failure(let error): throw error
        case nil: throw SyncTransportError.retryable(status: nil)
        }
    }

    /// A bundled demo body (`Resources/DemoAPI`) as a fetch answer.
    static func demo(_ name: String) -> Result<Data, SyncTransportError> {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json"), let data = try? Data(contentsOf: url)
        else { return .failure(.invalidResponse) }
        return .success(data)
    }
}
