import Foundation
import LiftSync

/// Made-up App API bodies for demo data (TEST-8), so `-demo` screenshots show full screens. Each path reads a bundled
/// JSON file named after it (`resourceNames(for:query:)`); `<parent>-id.json` can stand for every id. Add a screen's
/// demo body as `Resources/DemoAPI/<name>.json`.
final class DemoAppData: AppDataSource {
    let isConnected = true
    private let bundle: Bundle
    private let now: @Sendable () -> Date

    init(bundle: Bundle, now: @escaping @Sendable () -> Date) {
        self.bundle = bundle
        self.now = now
    }

    func kept(_: String) async -> AppAPIKept? { nil }

    /// One made-up body per path; a `before` cursor names a later page. The bundle is read off the main actor, like the
    /// live cache; `AppResource` decodes off it too.
    func fetch(_ path: String, query: [URLQueryItem]) async throws -> AppAPIKept {
        guard let data = await Self.read(Self.resourceNames(for: path, query: query), in: bundle) else {
            throw SyncTransportError.rejected(status: 404)
        }
        return AppAPIKept(data: data, fetchedAt: now())
    }

    /// The first of `names` the bundle has, read from disk.
    @concurrent
    nonisolated static func read(_ names: [String], in bundle: Bundle) async -> Data? {
        for name in names {
            if let url = bundle.url(forResource: name, withExtension: "json"), let data = try? Data(contentsOf: url) {
                return data
            }
        }
        return nil
    }

    /// The file names to try, most specific first. "api/app/activities/123" → `app-activities-123`, then
    /// `app-activities-id` (one body for every id), then `app-activities`. A `before` cursor comes first as
    /// `app-activities-before-<cursor>`; other query items (a page size) are not in the name.
    nonisolated static func resourceNames(for path: String, query: [URLQueryItem] = []) -> [String] {
        var parts = path.split(separator: "/").map(String.init)
        if parts.first == "api" { parts.removeFirst() }
        guard parts.count > 1 else { return [] }
        let exact = parts.joined(separator: "-")
        let cursor = query.first { $0.name == "before" }?.value.map { ["\(exact)-before-\($0)"] } ?? []
        guard parts.count > 2 else { return cursor + [exact] }
        let parent = parts.dropLast().joined(separator: "-")
        return cursor + [exact, "\(parent)-id", parent]
    }
}
