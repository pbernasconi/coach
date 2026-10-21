import Foundation
import LiftCore
import LiftStore
import LiftSync

extension CompositionRoot {
    /// The coach's weekly plan: fetched over the sync server and token when this build syncs, made up for demo and practice data,
    /// and off otherwise (`-fresh`, no server), when the Week screen shows only Lift sessions.
    static func makeCoachPlan(
        source: AppInfo.DataSource,
        sessions: any SessionRepository,
        sync: any Syncing,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) -> any CoachPlanProviding {
        if source.isSample {
            return DemoCoachPlan(sessions: sessions, now: now, calendar: calendar)
        }
        let baseURL = SyncServer.baseURL(from: Bundle.main.object(forInfoDictionaryKey: SyncServer.infoKey))
        guard source.isSaved, sync.isConfigured, let baseURL else { return DisabledCoachPlan() }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.timeoutIntervalForRequest = 30
        configuration.waitsForConnectivity = false
        let client = URLSessionCoachPlanClient(
            session: URLSession(configuration: configuration),
            baseURL: baseURL,
            tokens: syncTokenStore()
        )
        return LiveCoachPlan(client: client, cache: coachPlanCache(), sync: sync, now: now, calendar: calendar)
    }

    /// Application Support/CoachPlan, or a temporary folder when Application Support cannot be made.
    private static func coachPlanCache() -> any CoachPlanStoring {
        let support = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let folder = support ?? FileManager.default.temporaryDirectory
        return FileCoachPlanCache(directory: folder.appending(path: "CoachPlan"))
    }
}
