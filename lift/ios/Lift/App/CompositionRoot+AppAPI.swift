import Foundation
import LiftSync

extension CompositionRoot {
    /// The coach's read-only pages (lift/APP-API.md): fetched over the sync server and token when this build syncs,
    /// made up for demo data, and not connected otherwise (`-fresh`, no server).
    static func makeAppData(
        source: AppInfo.DataSource,
        sync: any Syncing,
        now: @escaping @Sendable () -> Date
    ) -> any AppDataSource {
        if source == .demo { return DemoAppData(bundle: .main, now: now) }
        let baseURL = SyncServer.baseURL(from: Bundle.main.object(forInfoDictionaryKey: SyncServer.infoKey))
        guard source.isSaved, sync.isConfigured, let baseURL else { return DisabledAppData() }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.timeoutIntervalForRequest = 30
        configuration.waitsForConnectivity = false
        let client = URLSessionAppAPIClient(
            session: URLSession(configuration: configuration),
            baseURL: baseURL,
            tokens: syncTokenStore(),
            timeZone: { TimeZone.current.identifier }  // read per request: follows the device while traveling
        )
        return LiveAppData(client: client, cache: FileAppAPICache(directory: appSupport("AppAPI")), now: now)
    }

    /// A folder in Application Support, or in the temporary folder when Application Support cannot be made.
    static func appSupport(_ name: String) -> URL {
        let support = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return (support ?? FileManager.default.temporaryDirectory).appending(path: name)
    }
}
