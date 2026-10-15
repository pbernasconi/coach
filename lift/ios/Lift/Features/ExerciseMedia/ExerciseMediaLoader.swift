import Foundation

/// Fetches media bytes by URL. The live loader caches on disk and shares one download per URL; tests and previews use
/// fakes that never touch the network (DI-5).
nonisolated protocol ExerciseMediaLoader: Sendable {
    func data(for url: URL) async throws -> Data
}

/// One HTTP GET. Behind a protocol so the loader's caching and coalescing are testable without a network.
nonisolated protocol ExerciseMediaTransport: Sendable {
    /// The body and HTTP status of a GET of `url`.
    func get(_ url: URL) async throws -> (data: Data, status: Int)
}

/// `ExerciseMediaTransport` over an injected `URLSession` (never `.shared`, DI-3).
nonisolated struct URLSessionMediaTransport: ExerciseMediaTransport {
    let session: URLSession

    func get(_ url: URL) async throws -> (data: Data, status: Int) {
        let (data, response) = try await session.data(from: url)
        return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
    }
}

/// Why a download was refused.
nonisolated enum ExerciseMediaError: Error, Equatable, Sendable {
    case status(Int)
    case empty
    case tooLarge(Int)
}
