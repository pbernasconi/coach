import Foundation
import LiftCore
import LiftSync

/// Made-up App API bodies for demo data (TEST-8), so `-demo` screenshots show full screens. Each path reads a bundled
/// JSON file named after it (`resourceNames(for:query:)`); `<parent>-id.json` can stand for every id. Add a screen's
/// demo body as `Resources/DemoAPI/<name>.json`.
final class DemoAppData: AppDataSource {
    let isConnected = true
    private let bundle: Bundle
    private let now: @Sendable () -> Date

    init(bundle: Bundle, now: @escaping @Sendable () -> Date) {
        self.bundle = bundle
        self.now = now
    }

    func kept(_: String) async -> AppAPIKept? { nil }

    /// One made-up body per path; a `before` cursor names a later page. The bundle is read off the main actor, like the
    /// live cache; `AppResource` decodes off it too.
    func fetch(_ path: String, query: [URLQueryItem]) async throws -> AppAPIKept {
        if let ref = path.split(separator: "/").last, path.hasPrefix(WorkoutDetail.path("")) {
            let today = LocalDay(now(), calendar: .current)
            guard let data = await Self.workout(String(ref), in: bundle, today: today) else {
                throw SyncTransportError.rejected(status: 404)
            }
            return AppAPIKept(data: data, fetchedAt: now())
        }
        guard let data = await Self.read(Self.resourceNames(for: path, query: query), in: bundle) else {
            throw SyncTransportError.rejected(status: 404)
        }
        return AppAPIKept(data: data, fetchedAt: now())
    }

    /// A demo write saves nothing: it answers with what was sent, as the server answers with what it saved.
    func put(_: String, body: Data) async throws -> Data { body }

    /// The first of `names` the bundle has, read from disk.
    @concurrent
    nonisolated static func read(_ names: [String], in bundle: Bundle) async -> Data? {
        for name in names {
            if let url = bundle.url(forResource: name, withExtension: "json"), let data = try? Data(contentsOf: url) {
                return data
            }
        }
        return nil
    }

    /// The file names to try, most specific first. "api/app/activities/123" → `app-activities-123`, then
    /// `app-activities-id` (one body for every id), then `app-activities`. A `before` cursor comes first as
    /// `app-activities-before-<cursor>`; other query items (a page size) are not in the name.
    nonisolated static func resourceNames(for path: String, query: [URLQueryItem] = []) -> [String] {
        var parts = path.split(separator: "/").map(String.init)
        if parts.first == "api" { parts.removeFirst() }
        guard parts.count > 1 else { return [] }
        let exact = parts.joined(separator: "-")
        let cursor = query.first { $0.name == "before" }?.value.map { ["\(exact)-before-\($0)"] } ?? []
        guard parts.count > 2 else { return cursor + [exact] }
        let parent = parts.dropLast().joined(separator: "-")
        return cursor + [exact, "\(parent)-id", parent]
    }

    /// A demo workout, put together as the server does: the demo activity for `strava-<id>`, the demo plan workout for
    /// `plan-<id>`, with the plan's match (or the activity's planned workout) as its other half when the demo has one.
    /// With `today`, a made-up week's workout (`plan-ride-<days since 1970>`) takes its own day and the state the
    /// server would send for it, so it never says "Today" on another day.
    @concurrent
    nonisolated static func workout(_ ref: String, in bundle: Bundle, today: LocalDay? = nil) async -> Data? {
        let parts = ref.split(separator: "-", maxSplits: 1).map(String.init)
        guard parts.count == 2 else { return nil }
        func body(_ path: String) async -> [String: Any]? {
            guard let data = await read(resourceNames(for: path), in: bundle) else { return nil }
            return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        }
        var plan: [String: Any]?
        var activity: [String: Any]?
        if parts[0] == "plan" {
            plan = await body("api/app/plan/\(parts[1])")
            if let today, let day = demoDay(parts[1]), let found = plan { plan = dated(found, on: day, today: today) }
            if let done = plan?["done"] as? [String: Any], let id = done["activityId"] as? String {
                activity = await body("api/app/activities/\(id)")
            }
        } else {
            activity = await body("api/app/activities/\(parts[1])")
        }
        guard plan != nil || activity != nil else { return nil }
        let header = activity?["header"] as? [String: Any]
        let workout: [String: Any] = [
            "ref": ref,
            "state": activity == nil ? "planned" : "done",
            "title": (plan?["title"] as? String) ?? (header?["name"] as? String) ?? "",
            "plan": plan ?? NSNull(),
            "activity": activity ?? NSNull(),
            "feedback": activity?["feedback"] ?? plan?["feedback"] ?? NSNull(),
        ]
        return try? JSONSerialization.data(withJSONObject: workout)
    }

    /// The day in a made-up week's id ("ride-20515"), or nil for another id.
    nonisolated static func demoDay(_ id: String) -> LocalDay? {
        guard let last = id.split(separator: "-").last, let days = Int(last), id.contains("-") else { return nil }
        return LocalDay(daysSinceEpoch: days)
    }

    /// The plan body moved to `day`: its date, the week's workout for that weekday (title, sport), the day in its
    /// subtitle, and its state.
    nonisolated static func dated(_ plan: [String: Any], on day: LocalDay, today: LocalDay) -> [String: Any] {
        var plan = plan
        let calendar = Calendar(identifier: .gregorian)
        guard let date = calendar.date(from: DateComponents(year: day.year, month: day.month, day: day.day)) else {
            return plan
        }
        plan["date"] = String(format: "%04d-%02d-%02d", day.year, day.month, day.day)
        if let subtitle = plan["subtitle"] as? String {
            var parts = subtitle.components(separatedBy: " · ")
            if parts.count == 3 {
                parts[1] = date.formatted(.dateTime.weekday(.wide).month(.wide).day())
                plan["subtitle"] = parts.joined(separator: " · ")
            }
        }
        // The week's own workout for that weekday (Monday first; 1 January 1970 was a Thursday): its title and sport,
        // and the ride's intervals only on a ride.
        let entry = DemoCoachWeeks.otherSports[(day.daysSinceEpoch + 3) % 7]
        plan["title"] = entry.title
        plan["sport"] = entry.sport.rawValue
        plan["sportLabel"] = entry.sport.label
        if entry.sport != .ride { plan["workout"] = NSNull() }
        if var parts = (plan["subtitle"] as? String)?.components(separatedBy: " · "), parts.count == 3 {
            parts[0] = entry.sport.label
            plan["subtitle"] = parts.joined(separator: " · ")
        }
        let state = day == today ? "today" : day > today ? "planned" : "missed"
        plan["state"] = state
        plan["stateLabel"] = ["today": "Today", "planned": "Planned", "missed": "Missed"][state]
        return plan
    }
}
