import Foundation
import LiftSync

/// Where the read-only coach pages come from (lift/APP-API.md): `LiveAppData` fetches them and keeps the last good
/// body of each path; `DemoAppData` answers with bundled made-up bodies; `DisabledAppData` stands in when sync is off.
/// Screens read it through `AppResource`, never directly.
@MainActor
protocol AppDataSource: AnyObject {
    /// False when this build or launch cannot reach the coach (no server, `-fresh`): screens show "not connected".
    var isConnected: Bool { get }

    /// The body kept for `path` ("api/app/today"), or nil. Reads the disk off the main actor.
    func kept(_ path: String) async -> AppAPIKept?

    /// Fetches `path` with `query` now and keeps the body under the path and query. Throws `SyncTransportError`
    /// (`missingToken` when not connected yet).
    func fetch(_ path: String, query: [URLQueryItem]) async throws -> AppAPIKept
}

extension AppDataSource {
    /// Fetches `path` with no query.
    func fetch(_ path: String) async throws -> AppAPIKept {
        try await fetch(path, query: [])
    }
}

/// The cache key of a path and query: the path alone without a query, else "path?a=1&b=2".
nonisolated func appCacheKey(_ path: String, _ query: [URLQueryItem]) -> String {
    guard !query.isEmpty else { return path }
    return path + "?" + query.map { "\($0.name)=\($0.value ?? "")" }.joined(separator: "&")
}

/// The live source: the App API client and the on-disk cache.
final class LiveAppData: AppDataSource {
    let isConnected = true
    private let client: any AppAPIFetching
    private let cache: any AppAPIStoring
    private let now: @Sendable () -> Date

    init(client: any AppAPIFetching, cache: any AppAPIStoring, now: @escaping @Sendable () -> Date) {
        self.client = client
        self.cache = cache
        self.now = now
    }

    func kept(_ path: String) async -> AppAPIKept? {
        await Self.load(path, from: cache)
    }

    func fetch(_ path: String, query: [URLQueryItem]) async throws -> AppAPIKept {
        let kept = AppAPIKept(data: try await client.get(path, query: query), fetchedAt: now())
        await Self.save(kept, for: appCacheKey(path, query), in: cache)
        return kept
    }

    /// Disk reads and writes run off the main actor.
    @concurrent
    private nonisolated static func load(_ path: String, from cache: any AppAPIStoring) async -> AppAPIKept? {
        cache.load(path)
    }

    @concurrent
    private nonisolated static func save(_ kept: AppAPIKept, for key: String, in cache: any AppAPIStoring) async {
        do {
            try cache.save(kept, for: key)
        } catch {
            AppLog.sync.error("App API body not kept: \(String(describing: error), privacy: .public)")
        }
    }
}

/// Sync is off: nothing is kept and nothing is fetched.
final class DisabledAppData: AppDataSource {
    let isConnected = false

    func kept(_: String) async -> AppAPIKept? { nil }

    func fetch(_: String, query _: [URLQueryItem]) async throws -> AppAPIKept {
        throw SyncTransportError.missingToken
    }
}
