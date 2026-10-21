import Foundation
import LiftSync

/// Made-up App API bodies for demo data (TEST-8), so `-demo` screenshots show full screens. Each path reads a bundled
/// JSON file named after it (`resourceNames(for:query:)`); `<parent>-id.json` can stand for every id. Add a screen's demo body as `Resources/DemoAPI/<name>.json`.
final class DemoAppData: AppDataSource {
    let isConnected = true
    private let bundle: Bundle
    private let now: @Sendable () -> Date

    init(bundle: Bundle, now: @escaping @Sendable () -> Date) {
        self.bundle = bundle
        self.now = now
    }

    func kept(_: String) async -> AppAPIKept? { nil }

    /// The query is ignored: one made-up body per path.
    /// One made-up body per path; a `before` cursor names a later page.
    func fetch(_ path: String, query: [URLQueryItem]) async throws -> AppAPIKept {
        for name in Self.resourceNames(for: path, query: query) {
            if let url = bundle.url(forResource: name, withExtension: "json"), let data = try? Data(contentsOf: url) {
                return AppAPIKept(data: data, fetchedAt: now())
            }
        }
        throw SyncTransportError.rejected(status: 404)
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
