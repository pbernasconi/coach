import Foundation

/// One page of `GET /api/app/activities` (lift/APP-API.md, "Activities"): newest first.
nonisolated struct ActivityListPage: Decodable, Equatable, Sendable {
    static let path = "api/app/activities"

    var activities: [ActivitySummary]
    /// `false` when the plan lookup failed: every `plannedTitle` is `nil`, but the list still shows.
    var plannedOk: Bool
    /// The `before` of the next page; `nil` on the last page.
    var nextCursor: String?
}

/// A Strava activity in the list. Every text is ready to show.
nonisolated struct ActivitySummary: Decodable, Equatable, Sendable, Identifiable, Hashable {
    var activityId: String
    var name: String
    /// An id from `design/sports.json` (`Sport`).
    var sport: String
    /// Strava's type in words ("Virtual ride").
    var typeText: String
    var day: String
    /// "Sat, Oct 17 · 7:15 AM", on the activity's own clock.
    var startText: String
    /// "12.01 km · 1:07:18 · 5:36 /km · 84 TSS".
    var subtitle: String
    /// The plan workout this activity completed, without its emoji.
    var plannedTitle: String?
    var indoor: Bool
    var commute: Bool
    /// The page leads with a map (not indoors, some distance); missing from older servers.
    var outdoor: Bool?

    var id: String { activityId }

    /// The sport's colour and icon; unknown ids read as `other`.
    var sportStyle: Sport { Sport(rawValue: sport) ?? .other }
}
