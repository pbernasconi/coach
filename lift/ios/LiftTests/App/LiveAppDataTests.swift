import Foundation
import LiftSync
import Synchronization
import Testing

@testable import Lift

/// The live source keeps each body it is asked to keep, and at most `keptPerFamily` bodies of the paths opened by id.
@MainActor
@Suite struct LiveAppDataTests {
    /// Answers every path with its own name.
    nonisolated final class EchoClient: AppAPIFetching {
        func get(_ path: String, query _: [URLQueryItem]) async throws -> Data { Data(path.utf8) }
    }

    @Test func activityBodiesAreCappedToTheNewest() async throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: "LiveAppData-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let clock = Mutex(Date(timeIntervalSince1970: 1_792_528_200))
        let data = LiveAppData(
            client: EchoClient(),
            cache: FileAppAPICache(directory: folder),
            now: { clock.withLock { $0 } }
        )
        let count = LiveAppData.keptPerFamily + 2
        for index in 0..<count {
            clock.withLock { $0 = $0.addingTimeInterval(60) }
            let path = "api/app/activities/\(index)"
            await data.keep(try await data.fetch(path), for: path)
        }
        await data.keep(try await data.fetch(AppToday.path), for: AppToday.path)
        #expect(await data.kept("api/app/activities/0") == nil)
        #expect(await data.kept("api/app/activities/1") == nil)
        #expect(
            await data.kept("api/app/activities/\(count - 1)")?.data == Data("api/app/activities/\(count - 1)".utf8)
        )
        #expect(await data.kept(AppToday.path) != nil)
        let files = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        #expect(files.count == LiveAppData.keptPerFamily + 1)
    }
}
