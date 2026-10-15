import Foundation
import LiftStore
import LiftSync

extension CompositionRoot {
    /// Live sync over the device database when this build names a server, else `DisabledSync`. Demo data never
    /// syncs, whatever the build says.
    static func makeSync(
        database: LiftDatabase,
        isDemo: Bool,
        now: @escaping @Sendable () -> Date,
        makeID: @escaping @Sendable () -> UUID
    ) -> any Syncing {
        let baseURL = SyncServer.baseURL(from: Bundle.main.object(forInfoDictionaryKey: SyncServer.infoKey))
        guard !isDemo, let baseURL else { return DisabledSync() }
        let tokens = KeychainTokenStore(service: "app.lift.sync", account: "token")
        let transport = URLSessionSyncTransport(session: syncSession(), baseURL: baseURL, tokens: tokens)
        let engine = SyncEngine(
            outbox: LiveOutboxRepository(database: database),
            state: LiveSyncStateRepository(database: database, makeID: makeID),
            transport: transport,
            now: now,
            clock: ContinuousClock()
        )
        return LiveSync(engine: engine, tokens: tokens)
    }

    /// Sync's own URLSession (never `.shared`): no cache or cookies, and a failed request waits for the next sync
    /// instead of for connectivity.
    private static func syncSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.timeoutIntervalForRequest = 30
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }
}
