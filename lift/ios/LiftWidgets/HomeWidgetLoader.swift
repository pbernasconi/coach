import Foundation
import Security
import WidgetKit

/// One state of the Coach widget: a snapshot to show, or nil with a notice saying why there is none.
nonisolated struct HomeWidgetEntry: TimelineEntry {
    var date: Date
    var snapshot: HomeWidgetSnapshot?
    var notice: String?
}

/// Fetches `/api/app/today` for the widget with the app's sync token, which the widget reads from the app's Keychain
/// group (`keychain-access-groups` in `project.yml`; no App Group needed). The last good snapshot is kept in the
/// extension's caches, so the widget still shows numbers when the coach is out of reach.
nonisolated struct HomeWidgetLoader: Sendable {
    let baseURL: URL?
    let session: URLSession
    let cacheFile: URL?

    /// The coach's origin from this build's Info.plist (`LiftSyncBaseURL`, like the app), and a session of its own.
    static func live() -> HomeWidgetLoader {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.timeoutIntervalForRequest = 20
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
        return HomeWidgetLoader(
            baseURL: SyncServer.baseURL(from: Bundle.main.object(forInfoDictionaryKey: SyncServer.infoKey)),
            session: URLSession(configuration: configuration),
            cacheFile: caches?.appending(path: "coach-widget-today.json")
        )
    }

    /// The entry for `now`: fresh from the coach, else the kept snapshot (its workouts only when it is from today).
    func entry(now: Date, calendar: Calendar) async -> HomeWidgetEntry {
        guard let baseURL, let token = Self.syncToken() else {
            return HomeWidgetEntry(date: now, snapshot: nil, notice: String(localized: "Open Coach to connect"))
        }
        if let fresh = await fetch(baseURL: baseURL, token: token, timeZone: calendar.timeZone) {
            keep(fresh)
            return HomeWidgetEntry(date: now, snapshot: fresh, notice: nil)
        }
        guard let kept = kept() else {
            return HomeWidgetEntry(date: now, snapshot: nil, notice: String(localized: "Coach is out of reach"))
        }
        if kept.day == Self.plainDay(now, calendar: calendar) {
            return HomeWidgetEntry(date: now, snapshot: kept, notice: nil)
        }
        let stale = kept.keepingLoadOnly(note: String(localized: "Open Coach to refresh"))
        return HomeWidgetEntry(date: now, snapshot: stale, notice: nil)
    }

    private func fetch(baseURL: URL, token: String, timeZone: TimeZone) async -> HomeWidgetSnapshot? {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) ?? URLComponents()
        var path = components.percentEncodedPath
        if path.hasSuffix("/") { path.removeLast() }
        components.percentEncodedPath = path + "/api/app/today"
        components.queryItems = [URLQueryItem(name: "tz", value: timeZone.identifier)]
        // URLComponents leaves "+" as is, and the server reads it as a space ("Etc/GMT+8").
        components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        guard let url = components.url else { return nil }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        guard let result = try? await session.data(for: request),
            (result.1 as? HTTPURLResponse)?.statusCode == 200
        else { return nil }
        return try? HomeWidgetSnapshot.make(todayBody: result.0)
    }

    private func keep(_ snapshot: HomeWidgetSnapshot) {
        guard let cacheFile, let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: cacheFile, options: .atomic)
    }

    private func kept() -> HomeWidgetSnapshot? {
        guard let cacheFile, let data = try? Data(contentsOf: cacheFile) else { return nil }
        return try? JSONDecoder().decode(HomeWidgetSnapshot.self, from: data)
    }

    /// `YYYY-MM-DD` of `date` in `calendar`'s time zone, as the coach sends days.
    static func plainDay(_ date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// The app's sync token: the same Keychain item `KeychainTokenStore` writes (service "app.lift.sync", account
    /// "token"), readable after first unlock. Nil when it is missing or the Keychain says no.
    private static func syncToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "app.lift.sync",
            kSecAttrAccount as String: "token",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data,
            let token = String(bytes: data, encoding: .utf8), !token.isEmpty
        else { return nil }
        return token
    }
}
