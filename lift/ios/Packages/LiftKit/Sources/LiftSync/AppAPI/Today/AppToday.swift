import Foundation

/// `GET /api/app/today` (lift/APP-API.md, "Today"): the web's Today page. Every text is display-ready; raw numbers are
/// for charts only. Each section is independent (`AppSection`).
public struct AppToday: Decodable, Equatable, Sendable {
    public var generatedAt: String
    public var today: PlainDay
    /// "Tuesday, October 20".
    public var dateText: String
    public var header: AppSection<TodayHeader>
    public var stale: AppSection<TodayStale>
    public var todayLine: AppSection<TodayLine>
    public var fitness: AppSection<TodayFitness>
    public var last4Weeks: AppSection<TodayTiles>
    public var body: AppSection<TodayBody>
    public var lift: AppSection<TodayLift>
    public var goals: AppSection<TodayGoals>

    /// The path, relative to the coach's origin.
    public static let path = "api/app/today"

    private enum Keys: String, CodingKey {
        case generatedAt, today, dateText, header, stale, todayLine, fitness, last4Weeks, body, lift, goals
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        generatedAt = try container.decode(String.self, forKey: .generatedAt)
        today = try container.decode(PlainDay.self, forKey: .today)
        dateText = try container.decodeIfPresent(String.self, forKey: .dateText) ?? ""
        header = container.section(.header)
        stale = container.section(.stale)
        todayLine = container.section(.todayLine)
        fitness = container.section(.fitness)
        last4Weeks = container.section(.last4Weeks)
        body = container.section(.body)
        lift = container.section(.lift)
        goals = container.section(.goals)
    }
}

public struct TodayHeader: Decodable, Equatable, Sendable {
    public var chips: [TodayChip]
    /// "No Garmin data today." when there are no chips.
    public var emptyText: String?
}

/// A recovery or fitness value with the web's dot tone. The phone shows `valueText`, never the colour alone.
public struct TodayChip: Decodable, Equatable, Sendable, Identifiable {
    public var key: String
    public var label: String
    public var valueText: String
    public var tone: AppTone

    public var id: String { key }
}

public struct TodayStale: Decodable, Equatable, Sendable {
    /// "The newest Strava activity is from …" when it is old, else nil.
    public var text: String?
}

public struct TodayLine: Decodable, Equatable, Sendable {
    public var items: [TodayLineItem]
    /// "Rest day", or a note that there is no plan, when there are no items.
    public var emptyText: String?
    /// The readiness cue: "Readiness moderate: hold back about 10%".
    public var cue: String?
}

/// One of today's planned workouts. `id` is the Week API item id; `liftSessionId` names a Lift session.
public struct TodayLineItem: Decodable, Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var sport: String
    public var state: String
    /// "10:30 · 1:15", with " · done" once done.
    public var text: String
    public var liftSessionId: String?
}

/// The fitness chart: CTL, ATL and TSB by day, the form zones, events and a dashed projection.
public struct TodayFitness: Decodable, Equatable, Sendable {
    public var today: PlainDay
    public var days: [FitnessDay]
    public var zones: [FitnessZone]
    public var events: [FitnessEvent]
    public var now: FitnessNow?
    /// "Projection to …", or nil without a projection.
    public var caption: String?
}

public struct FitnessDay: Decodable, Equatable, Sendable {
    public var date: PlainDay
    public var ctl: Double
    public var atl: Double
    public var tsb: Double
    public var projected: Bool
}

/// A form band; nil ends are open. `shade`: draw it.
public struct FitnessZone: Decodable, Equatable, Sendable {
    public var label: String
    public var from: Double?
    public var to: Double?
    public var shade: Bool
}

public struct FitnessEvent: Decodable, Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var date: PlainDay
    /// "A" events get a label, "B" and "C" a thin line.
    public var priority: String
}

/// The last actual day: the source of the fitness and form chips.
public struct FitnessNow: Decodable, Equatable, Sendable {
    public var date: PlainDay
    public var ctl: Double
    public var atl: Double
    public var tsb: Double
    public var zone: String?
}

public struct TodayTiles: Decodable, Equatable, Sendable {
    public var tiles: [TodayTile]
}

public struct TodayTile: Decodable, Equatable, Sendable, Identifiable {
    public var key: String
    public var label: String
    public var valueText: String
    public var noteText: String?
    /// A `design/sports.json` id for the tile's dot, or nil for ink.
    public var sport: String?

    public var id: String { key }
}
