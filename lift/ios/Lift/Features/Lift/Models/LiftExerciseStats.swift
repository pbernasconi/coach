import Foundation
import LiftSync

/// `GET /api/app/lift/exercises/{key}`: one exercise's stats, e1RM chart, sessions and best sets.
nonisolated struct LiftExerciseStats: Decodable, Equatable, Sendable {
    var exerciseKey: String
    var name: String
    var unit: String
    var stats: AppSection<LiftExerciseStatTiles>
    var chart: AppSection<LiftExerciseChart>
    var sessions: AppSection<LiftExerciseSessions>
    var bestSets: AppSection<LiftBestSets>
}

nonisolated struct LiftExerciseStatTiles: Decodable, Equatable, Sendable {
    /// Always 4.
    var items: [LiftStat]
}

nonisolated struct LiftExerciseChart: Decodable, Equatable, Sendable {
    var title: String
    var caption: String
    var emptyText: String
    /// Oldest first, at most 120.
    var points: [LiftE1RMPoint]
}

nonisolated struct LiftExerciseSessions: Decodable, Equatable, Sendable {
    /// Newest first.
    var items: [LiftExerciseSession]
}

nonisolated struct LiftExerciseSession: Decodable, Equatable, Sendable, Identifiable {
    var date: String
    var dateText: String
    var sessionId: String
    var bestSetText: String
    var e1rmText: String

    var id: String { sessionId }
}

nonisolated struct LiftBestSets: Decodable, Equatable, Sendable {
    var title: String
    var caption: String
    /// Ranked by e1RM; each carries its rank, since straight sets (3 × 60 × 8) repeat every other field.
    var items: [LiftBestSet]

    private enum Key: String, CodingKey { case title, caption, items }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Key.self)
        title = try container.decode(String.self, forKey: .title)
        caption = try container.decode(String.self, forKey: .caption)
        items = try container.decode([LiftBestSet].self, forKey: .items).enumerated().map { rank, set in
            var ranked = set
            ranked.rank = rank
            return ranked
        }
    }
}

nonisolated struct LiftBestSet: Decodable, Equatable, Sendable, Identifiable {
    var date: String
    var dateText: String
    var sessionId: String
    var weightText: String
    var repsText: String
    var e1rmText: String
    /// The set's place in the list, from 0; set by `LiftBestSets`.
    var rank = 0

    private enum CodingKeys: String, CodingKey { case date, dateText, sessionId, weightText, repsText, e1rmText }

    var id: Int { rank }
}
