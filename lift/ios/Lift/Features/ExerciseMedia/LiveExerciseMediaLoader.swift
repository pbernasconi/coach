import Foundation

/// Downloads media through an injected transport, keeps it in `Caches/ExerciseMedia`, and shares one download among
/// everyone who asks for the same URL at the same time. Small files only: the dataset's 180 × 180 stills and GIFs.
actor LiveExerciseMediaLoader: ExerciseMediaLoader {
    /// Anything larger is not one of the dataset's files.
    static let maxBytes = 4 * 1024 * 1024
    /// Recently used files kept in memory, so a list scrolling back does not read the disk again.
    static let memoryLimit = 64

    private let transport: any ExerciseMediaTransport
    private let cache: MediaDiskCache
    private var inFlight: [String: Task<Data, any Error>] = [:]
    private var memory: [String: Data] = [:]
    private var recent: [String] = []

    init(transport: any ExerciseMediaTransport, cache: MediaDiskCache) {
        self.transport = transport
        self.cache = cache
    }

    func data(for url: URL) async throws -> Data {
        let key = MediaDiskCache.key(for: url)
        if let data = memory[key] {
            remember(data, for: key)
            return data
        }
        if let data = cache.read(key), !data.isEmpty {
            remember(data, for: key)
            return data
        }
        if let running = inFlight[key] {
            return try await running.value
        }
        let transport = transport
        let download = Task { try await Self.download(url, with: transport) }
        inFlight[key] = download
        defer { inFlight[key] = nil }
        let data = try await download.value
        cache.write(data, for: key)
        remember(data, for: key)
        return data
    }

    private static func download(_ url: URL, with transport: any ExerciseMediaTransport) async throws -> Data {
        let (data, status) = try await transport.get(url)
        guard (200..<300).contains(status) else { throw ExerciseMediaError.status(status) }
        guard !data.isEmpty else { throw ExerciseMediaError.empty }
        guard data.count <= maxBytes else { throw ExerciseMediaError.tooLarge(data.count) }
        return data
    }

    private func remember(_ data: Data, for key: String) {
        memory[key] = data
        recent.removeAll { $0 == key }
        recent.append(key)
        while recent.count > Self.memoryLimit {
            memory[recent.removeFirst()] = nil
        }
    }
}
