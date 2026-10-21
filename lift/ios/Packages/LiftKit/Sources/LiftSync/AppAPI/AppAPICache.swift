import Foundation

/// A kept App API body and when it was fetched.
public struct AppAPIKept: Equatable, Sendable {
    public var data: Data
    public var fetchedAt: Date

    public init(data: Data, fetchedAt: Date) {
        self.data = data
        self.fetchedAt = fetchedAt
    }
}

/// Keeps the last good body of each App API path on disk, so a screen shows it at once and when offline.
/// `FileAppAPICache` is the live one; tests use one in memory.
public protocol AppAPIStoring: Sendable {
    /// The body kept for `path`, or nil.
    func load(_ path: String) -> AppAPIKept?
    /// Keeps `kept` for `path`, replacing the one kept before.
    func save(_ kept: AppAPIKept, for path: String) throws
    /// Keeps only the `count` most recently fetched bodies whose path starts with `prefix` ("api/app/activities/"), so
    /// pages opened by id do not pile up.
    func prune(prefix: String, keeping count: Int)
}

/// One file per path in a folder (Application Support/AppAPI in the app); the file's date is when it was fetched.
public struct FileAppAPICache: AppAPIStoring {
    private let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    public func load(_ path: String) -> AppAPIKept? {
        let url = file(path)
        guard let data = try? Data(contentsOf: url),
            let date = try? FileManager.default.attributesOfItem(atPath: url.path)[.modificationDate] as? Date
        else { return nil }
        return AppAPIKept(data: data, fetchedAt: date)
    }

    public func save(_ kept: AppAPIKept, for path: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = file(path)
        try kept.data.write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.modificationDate: kept.fetchedAt], ofItemAtPath: url.path)
    }

    public func prune(prefix: String, keeping count: Int) {
        let start = Self.fileName(prefix).dropLast(".json".count)
        let urls =
            (try? FileManager.default.contentsOfDirectory(
                at: directory,
                includingPropertiesForKeys: [.contentModificationDateKey]
            )) ?? []
        let family = urls.filter { $0.lastPathComponent.hasPrefix(start) }
        guard family.count > count else { return }
        let date = { (url: URL) in
            (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
        }
        for url in family.sorted(by: { date($0) > date($1) }).dropFirst(max(count, 0)) {
            try? FileManager.default.removeItem(at: url)
        }
    }

    /// "api/app/lift/sessions/ab-12" → "api_app_lift_sessions_ab-12.json": letters, digits, "-" and "." kept.
    static func fileName(_ path: String) -> String {
        let safe = path.unicodeScalars.map { scalar in
            CharacterSet.alphanumerics.contains(scalar) || scalar == "-" || scalar == "." ? Character(scalar) : "_"
        }
        return String(safe) + ".json"
    }

    private func file(_ path: String) -> URL {
        directory.appending(path: Self.fileName(path))
    }
}
