import Foundation

/// Per-kilometre splits (foot sports).
nonisolated struct ActivitySplits: Decodable, Equatable, Sendable {
    nonisolated struct Row: Decodable, Equatable, Sendable {
        var index: Int
        var label: String
        /// m/s: the bar's length. `nil` without a speed.
        var speed: Double?
        var paceText: String
        var gapText: String?
        var elevText: String
        var hrText: String
    }

    var note: String?
    var rows: [Row]
}

/// Other activities of the same sport on this route, fastest first.
nonisolated struct ActivitySameRoute: Decodable, Equatable, Sendable {
    nonisolated struct Row: Decodable, Equatable, Sendable {
        var activityId: String
        /// This activity: shown, but not a link.
        var isThis: Bool
        var day: String
        var name: String
        var distanceText: String
        var timeText: String
        var paceText: String
    }

    var title: String
    var note: String?
    var rows: [Row]
}

nonisolated struct ActivityLaps: Decodable, Equatable, Sendable {
    nonisolated struct Row: Decodable, Equatable, Sendable {
        var index: Int
        var name: String
        var distanceText: String
        var timeText: String
        var paceText: String
        var gapText: String
        var elevText: String
        var hrText: String
        var powerText: String
    }

    /// Show the power column.
    var hasPower: Bool
    /// Show the GAP column.
    var hasGap: Bool
    var rows: [Row]
}

nonisolated struct ActivityBestEfforts: Decodable, Equatable, Sendable {
    nonisolated struct Row: Decodable, Equatable, Sendable {
        var label: String
        var prRank: Int?
        var timeText: String
        var paceText: String
        /// "PR", "2nd best" or "".
        var rankText: String
    }

    var note: String?
    var rows: [Row]
}

nonisolated struct ActivitySegments: Decodable, Equatable, Sendable {
    nonisolated struct Row: Decodable, Equatable, Sendable {
        var id: String
        var name: String
        var prRank: Int?
        var komRank: Int?
        var distanceText: String
        var gradeText: String
        var timeText: String
        var paceText: String
        var hrText: String
        var rankText: String
    }

    /// Every segment; `rows` holds the top 15.
    var count: Int
    var note: String?
    var rows: [Row]
}
