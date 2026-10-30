import Foundation

/// What the Coach Home Screen widget shows: fitness, form and fatigue, and today's planned workouts. Made from the
/// coach's `GET /api/app/today` (lift/APP-API.md, "Today"), which the widget fetches itself. Compiled into the app
/// (the demo gallery, `-open widgets`) and LiftWidgets.
nonisolated struct HomeWidgetSnapshot: Codable, Equatable, Sendable {
    /// Fitness (CTL), fatigue (ATL) and form (TSB) on the last actual day, rounded as the web shows them.
    nonisolated struct Load: Codable, Equatable, Sendable {
        var fitness: Int
        var form: Int
        var fatigue: Int
    }

    /// One of today's planned workouts.
    nonisolated struct Workout: Codable, Equatable, Sendable, Identifiable {
        var id: String
        var title: String
        /// A `design/sports.json` id ("run", "strength"), or anything else for the neutral icon.
        var sport: String
        /// "10:30 · 1:15", without the server's " · done" (a done workout shows a tick instead).
        var detail: String
        var isDone: Bool
        /// The Lift session a strength workout opens, lower-case.
        var liftSessionID: String?
    }

    /// The server's day, `YYYY-MM-DD`.
    var day: String
    var load: Load?
    var workouts: [Workout]
    /// "Rest day", or the note that there is no plan, when there are no workouts.
    var emptyText: String?

    /// The snapshot in a `/api/app/today` body. Each section may have failed on the server; a failed one is left out.
    static func make(todayBody data: Data) throws -> HomeWidgetSnapshot {
        let body = try JSONDecoder().decode(TodayBody.self, from: data)
        let load = body.fitness?.now.map {
            Load(fitness: Int($0.ctl.rounded()), form: Int($0.tsb.rounded()), fatigue: Int($0.atl.rounded()))
        }
        let workouts = (body.todayLine?.items ?? []).map { item in
            let isDone = item.state == "done"
            let suffix = " · done"
            let detail = isDone && item.text.hasSuffix(suffix) ? String(item.text.dropLast(suffix.count)) : item.text
            return Workout(
                id: item.id,
                title: item.title,
                sport: item.sport,
                detail: detail,
                isDone: isDone,
                liftSessionID: item.liftSessionId
            )
        }
        return HomeWidgetSnapshot(day: body.today, load: load, workouts: workouts, emptyText: body.todayLine?.emptyText)
    }

    /// The same snapshot without its workouts, for a day it was not made on: the load still reads right for a while,
    /// a plan from yesterday does not.
    func keepingLoadOnly(note: String) -> HomeWidgetSnapshot {
        HomeWidgetSnapshot(day: day, load: load, workouts: [], emptyText: note)
    }

    /// Where a tap on a workout goes: its Lift session, else the Today tab.
    static func link(for workout: Workout?) -> URL? {
        if let id = workout?.liftSessionID, UUID(uuidString: id) != nil {
            return URL(string: "lift://session/\(id)")
        }
        return URL(string: "lift://today")
    }
}

/// The parts of `/api/app/today` the widget reads. Every section is optional, so one that failed (`ok: false`, or a
/// shape this build does not know) leaves its part of the widget empty instead of failing the whole body.
private nonisolated struct TodayBody: Decodable {
    nonisolated struct Fitness: Decodable {
        nonisolated struct Now: Decodable {
            var ctl: Double
            var atl: Double
            var tsb: Double
        }
        var now: Now?
    }

    nonisolated struct Line: Decodable {
        nonisolated struct Item: Decodable {
            var id: String
            var title: String
            var sport: String
            var state: String
            var text: String
            var liftSessionId: String?
        }
        var items: [Item]
        var emptyText: String?
    }

    var today: String
    var fitness: Fitness?
    var todayLine: Line?

    private nonisolated enum Keys: String, CodingKey { case today, fitness, todayLine }
    private nonisolated enum SectionKeys: String, CodingKey { case ok }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        today = try container.decode(String.self, forKey: .today)
        fitness = Self.section(Fitness.self, .fitness, in: container)
        todayLine = Self.section(Line.self, .todayLine, in: container)
    }

    /// A section whose `ok` is true and that decodes, else nil.
    private static func section<Value: Decodable>(
        _: Value.Type,
        _ key: Keys,
        in container: KeyedDecodingContainer<Keys>
    ) -> Value? {
        guard let flags = try? container.nestedContainer(keyedBy: SectionKeys.self, forKey: key),
            (try? flags.decode(Bool.self, forKey: .ok)) == true
        else { return nil }
        return try? container.decode(Value.self, forKey: key)
    }
}
