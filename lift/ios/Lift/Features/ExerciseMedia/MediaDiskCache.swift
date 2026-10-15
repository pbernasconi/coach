import Foundation

/// Media bytes on disk, one file per URL path under `Caches/ExerciseMedia`. The system may purge Caches at any time;
/// a miss just downloads again. Failures to read or write are misses, never errors.
nonisolated struct MediaDiskCache: Sendable {
    let directory: URL

    /// `Library/Caches/ExerciseMedia` for this app.
    static func inCaches(fileManager: FileManager) throws -> MediaDiskCache {
        let caches = try fileManager.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return MediaDiskCache(directory: caches.appending(path: "ExerciseMedia", directoryHint: .isDirectory))
    }

    /// The cache key of `url`: its path, with every character outside `[A-Za-z0-9._-]` turned into `_`. The path holds
    /// the pinned commit, so a new commit never reads an old file.
    static func key(for url: URL) -> String {
        let mapped = url.path().map { character -> Character in
            character.isASCII && (character.isLetter || character.isNumber || "._-".contains(character)) ? character : "_"
        }
        return String(mapped)
    }

    func read(_ key: String) -> Data? {
        try? Data(contentsOf: file(key))
    }

    func write(_ data: Data, for key: String) {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try data.write(to: file(key), options: .atomic)
        } catch {
            // A cache that cannot be written is only slower.
        }
    }

    private func file(_ key: String) -> URL {
        directory.appending(path: key, directoryHint: .notDirectory)
    }
}
