import Foundation
import Synchronization
import Testing

@testable import Lift

/// The live loader with a fake transport and a cache in a temporary folder: no network (TEST-3).
@Suite struct LiveExerciseMediaLoaderTests {
    let url = URL(string: "https://raw.githubusercontent.com/o/r/abc/videos/0001-x.gif")

    func makeCache() -> MediaDiskCache {
        MediaDiskCache(
            directory: FileManager.default.temporaryDirectory.appending(
                path: "media-tests-\(UInt64.random(in: 0...UInt64.max))"
            )
        )
    }

    @Test func downloadsOnceThenServesFromTheCache() async throws {
        let url = try #require(url)
        let transport = FakeMediaTransport(responses: [(Data([1, 2, 3]), 200)])
        let cache = makeCache()
        let loader = LiveExerciseMediaLoader(transport: transport, cache: cache)
        #expect(try await loader.data(for: url) == Data([1, 2, 3]))
        #expect(try await loader.data(for: url) == Data([1, 2, 3]))
        #expect(transport.requests.count == 1)
        let relaunched = LiveExerciseMediaLoader(transport: transport, cache: cache)
        #expect(try await relaunched.data(for: url) == Data([1, 2, 3]))
        #expect(transport.requests.count == 1)
        #expect(cache.read(MediaDiskCache.key(for: url)) == Data([1, 2, 3]))
    }

    @Test func concurrentRequestsShareOneDownload() async throws {
        let url = try #require(url)
        let transport = FakeMediaTransport(responses: [(Data([9]), 200)], holds: true)
        let loader = LiveExerciseMediaLoader(transport: transport, cache: makeCache())
        async let first = loader.data(for: url)
        async let second = loader.data(for: url)
        await transport.waitForRequest()
        transport.release()
        #expect(try await [first, second] == [Data([9]), Data([9])])
        #expect(transport.requests.count == 1)
    }

    @Test(arguments: [(Data([1]), 404, ExerciseMediaError.status(404)), (Data(), 200, ExerciseMediaError.empty)])
    func refusesBadResponses(data: Data, status: Int, expected: ExerciseMediaError) async throws {
        let url = try #require(url)
        let loader = LiveExerciseMediaLoader(
            transport: FakeMediaTransport(responses: [(data, status)]),
            cache: makeCache()
        )
        await #expect(throws: expected) { try await loader.data(for: url) }
    }

    @Test func cacheKeysAreFlatFileNames() throws {
        let key = MediaDiskCache.key(for: try #require(url))
        #expect(key == "_o_r_abc_videos_0001-x.gif")
        #expect(!key.contains("/"))
    }

    @Test func mediaImageLoadMapsErrorsToFailed() async throws {
        let failing = LiveExerciseMediaLoader(transport: FakeMediaTransport(responses: []), cache: makeCache())
        let url: URL = try #require(url)
        #expect(await MediaImage.load(url, with: failing) == .failed)
        #expect(await MediaImage.load(nil, with: failing) == .failed)
    }
}

/// Answers GETs from a queue; with `holds`, each GET waits for `release()`.
nonisolated final class FakeMediaTransport: ExerciseMediaTransport {
    private struct State {
        var responses: [(Data, Int)]
        var requests: [URL] = []
        var held: [CheckedContinuation<Void, Never>] = []
        var waiters: [CheckedContinuation<Void, Never>] = []
    }

    private let state: Mutex<State>
    private let holds: Bool

    init(responses: [(Data, Int)], holds: Bool = false) {
        state = Mutex(State(responses: responses))
        self.holds = holds
    }

    var requests: [URL] { state.withLock { $0.requests } }

    func get(_ url: URL) async throws -> (data: Data, status: Int) {
        if holds {
            await withCheckedContinuation { continuation in
                let waiters = state.withLock { state in
                    state.requests.append(url)
                    state.held.append(continuation)
                    defer { state.waiters = [] }
                    return state.waiters
                }
                waiters.forEach { $0.resume() }
            }
        } else {
            state.withLock { $0.requests.append(url) }
        }
        let response = state.withLock { state in state.responses.isEmpty ? nil : state.responses.removeFirst() }
        guard let response else { throw URLError(.notConnectedToInternet) }
        return (response.0, response.1)
    }

    /// Returns once a GET has started.
    func waitForRequest() async {
        await withCheckedContinuation { continuation in
            let started = state.withLock { state in
                if state.requests.isEmpty { state.waiters.append(continuation) }
                return !state.requests.isEmpty
            }
            if started { continuation.resume() }
        }
    }

    func release() {
        let held = state.withLock { state in
            defer { state.held = [] }
            return state.held
        }
        held.forEach { $0.resume() }
    }
}
