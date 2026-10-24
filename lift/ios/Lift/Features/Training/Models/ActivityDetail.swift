import Foundation
import LiftSync

/// `GET /api/app/activities/{id}` (lift/APP-API.md, "Detail"): the web's activity page, section by section in its
/// order. A `nil` section is one this activity does not have (`null`: hide it); `.failed` is one that could not load.
nonisolated struct ActivityDetail: Decodable, Equatable, Sendable {
    /// The path of one activity: a Strava id, a Coach row id, or `latest`.
    static func path(_ id: String) -> String { "api/app/activities/\(id)" }

    var activityId: String
    var header: AppSection<ActivityHeader>?
    var overview: AppSection<ActivityOverview>?
    var weather: AppSection<ActivityWeather>?
    var equipment: AppSection<ActivityEquipment>?
    var splits: AppSection<ActivitySplits>?
    var route: AppSection<ActivityRoute>?
    var sameRoute: AppSection<ActivitySameRoute>?
    var coach: AppSection<ActivityCoach>?
    var analysis: AppSection<ActivityAnalysis>?
    var paceBars: AppSection<ActivityPaceBars>?
    var paceHistogram: AppSection<ActivityPaceHistogram>?
    var relativeEffort: AppSection<ActivityRelativeEffort>?
    var heartRate: AppSection<ActivityZones>?
    var power: AppSection<ActivityPower>?
    var laps: AppSection<ActivityLaps>?
    var bestEfforts: AppSection<ActivityBestEfforts>?
    var segments: AppSection<ActivitySegments>?
    /// "How did it feel"; nil when it did not load (or an older server).
    var feedback: WorkoutFeedback?

    /// The "Loading details from Strava" note to show under the header, if any.
    var fetchNote: String? { header?.value?.fetch.note }
}

/// The page's title block: name, when and where, the older and newer activity, and the Strava link.
nonisolated struct ActivityHeader: Decodable, Equatable, Sendable {
    nonisolated struct Fetch: Decodable, Equatable, Sendable {
        /// Coach is still fetching the details from Strava.
        var pending: Bool
        var note: String?
    }

    var name: String
    var sport: String
    var typeText: String
    var whenText: String
    var place: String?
    /// Strava's trainer flag.
    var indoor: Bool
    var commute: Bool
    /// A real track outdoors: the page leads with the map. `nil` from a server before this field.
    var outdoor: Bool?
    var subtitle: String
    var description: String?
    /// The older activity.
    var prevId: String?
    /// The newer activity.
    var nextId: String?
    var stravaUrl: String
    var fetch: Fetch

    var sportStyle: Sport { Sport(rawValue: sport) ?? .other }
}

/// The stat tiles: `big` first, then `small`, as the web shows them.
nonisolated struct ActivityOverview: Decodable, Equatable, Sendable {
    nonisolated struct Stat: Decodable, Equatable, Sendable, Hashable {
        var label: String
        var valueText: String
        var unit: String?
    }

    var big: [Stat]
    var small: [Stat]
    /// The six headline stats in the sport's order. `nil` from a server before this field: the first six of `big` and
    /// `small`.
    var grid: [Stat]?
    /// Every stat not in `grid`.
    var more: [Stat]?
    /// "7 PRs · 7 achievements · 4 kudos".
    var achievementsText: String?
    /// Every stat by meaning (effort, heart and lungs, running form or power), each with a word that places it
    /// ("Improving", "Top 30%"). `nil` from a server before this field.
    var groups: [StatGroup]?
    /// The web's headline numbers, each with its companion (`sub`). Shown first on "All stats" with `groups`.
    var hero: [StatGroup.Row]?

    nonisolated struct StatGroup: Decodable, Equatable, Sendable, Identifiable {
        nonisolated struct Row: Decodable, Equatable, Sendable, Hashable {
            var key: String
            var label: String
            var valueText: String
            var unit: String?
            /// A companion number under a headline stat: "GAP 5:39", "max 173".
            var sub: String?
            var word: String?
        }

        var id: String
        var title: String
        var tag: String?
        var rows: [Row]
        /// The other load scores on one line each: "Garmin load 133", "Relative Effort 20".
        var footer: [String]?
    }

    var gridStats: [Stat] { grid ?? Array((big + small).prefix(6)) }
    var moreStats: [Stat] { more ?? Array((big + small).dropFirst(6)) }
}

nonisolated struct ActivityWeather: Decodable, Equatable, Sendable {
    var headline: String
    var rows: [LabelledValue]
    var source: String?
}

nonisolated struct ActivityEquipment: Decodable, Equatable, Sendable {
    nonisolated struct Gear: Decodable, Equatable, Sendable {
        var label: String
        var name: String
        var distanceText: String?
    }

    var device: String?
    var gear: Gear?
}

/// The route as `[lat, lng]` pairs, at most 500.
nonisolated struct ActivityRoute: Decodable, Equatable, Sendable {
    var points: [[Double]]
    /// The line coloured by a metric (the map's colour button); nil without a GPS stream or from an older server.
    var colored: ActivityRouteColors?

    /// The pairs with both numbers present.
    var coordinates: [(latitude: Double, longitude: Double)] {
        points.compactMap { pair in pair.count == 2 ? (pair[0], pair[1]) : nil }
    }
}
