import Foundation

/// What the activity list already knows about an activity, handed to its page as it opens: the page draws its final
/// layout from the first frame (an outdoor activity opens straight on its map) and shows the name at once, while the
/// rest loads.
nonisolated struct ActivitySeed: Equatable, Sendable {
    var name: String
    var sport: Sport
    /// "Run", "Virtual ride".
    var typeText: String
    /// "Sat, Oct 17 · 7:15 AM".
    var startText: String
    /// The page will lead with a map; `false` when the server did not say.
    var outdoor: Bool

    init(_ summary: ActivitySummary) {
        name = summary.name
        sport = summary.sportStyle
        typeText = summary.typeText
        startText = summary.startText
        outdoor = summary.outdoor ?? false
    }
}

/// The seeds of the activities opened from the list, by id, for the page that opens next.
protocol ActivitySeeding: AnyObject {
    func remember(_ summary: ActivitySummary)
    func seed(for activityID: String) -> ActivitySeed?
}

/// The app's one store of seeds, in memory.
final class ActivitySeeds: ActivitySeeding {
    private var seeds: [String: ActivitySeed] = [:]

    func remember(_ summary: ActivitySummary) {
        seeds[summary.activityId] = ActivitySeed(summary)
    }

    func seed(for activityID: String) -> ActivitySeed? {
        seeds[activityID]
    }
}
