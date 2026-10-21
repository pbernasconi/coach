import Foundation

/// The coach's view: the plan workout this activity completed, its load, and Garmin's values for the day.
nonisolated struct ActivityCoach: Decodable, Equatable, Sendable {
    nonisolated struct Planned: Decodable, Equatable, Sendable {
        nonisolated struct Compliance: Decodable, Equatable, Sendable {
            /// `good | done | partial | off | …`.
            var level: String
            var label: String
        }

        var title: String
        var plannedText: String
        var ratioText: String?
        var compliance: Compliance
    }

    nonisolated struct Load: Decodable, Equatable, Sendable {
        nonisolated struct Row: Decodable, Equatable, Sendable {
            var key: String
            var label: String
            var valueText: String
        }

        var tssText: String
        var methodText: String?
        var rows: [Row]
        var emptyText: String?
    }

    nonisolated struct Garmin: Decodable, Equatable, Sendable {
        nonisolated struct Row: Decodable, Equatable, Sendable {
            var key: String
            var label: String
            var valueText: String
        }

        var rows: [Row]
        var emptyText: String?
    }

    var planned: Planned?
    var plannedEmptyText: String?
    var load: Load
    var garmin: Garmin
}
