import Foundation
import LiftSync

/// Upcoming and logged sessions.
nonisolated struct LiftSessions: Decodable, Equatable, Sendable {
    var caption: String
    /// The web shows this many logged sessions and folds the rest.
    var shown: Int
    var upcoming: [LiftUpcomingSession]
    /// Newest first.
    var logged: [LiftLoggedSession]
}

nonisolated struct LiftUpcomingSession: Decodable, Equatable, Sendable, Identifiable {
    var sessionId: String
    var date: String
    var title: String
    var badge: String?
    var detail: String

    var id: String { sessionId }
}

nonisolated struct LiftLoggedSession: Decodable, Equatable, Sendable, Identifiable {
    var sessionId: String
    var date: String
    var weekdayText: String
    var dayText: String
    var monthText: String
    var title: String
    var meta: String
    var volumeText: String
    var volumeUnit: String
    /// Volume against the largest session, 0–1.
    var relative: Double
    var muscles: [String]
    var prs: [String]
    var prText: String?

    var id: String { sessionId }
}

/// Every exercise with a logged set, the most recent first.
nonisolated struct LiftExerciseIndex: Decodable, Equatable, Sendable {
    var title: String
    var count: Int
    var items: [LiftExerciseIndexItem]
}

nonisolated struct LiftExerciseIndexItem: Decodable, Equatable, Sendable, Identifiable {
    var exerciseKey: String
    var name: String
    var sessions: Int
    var detail: String
    var bestText: String?

    var id: String { exerciseKey }
}

/// 16 weeks: a heatmap of hard sets per day, sessions per week against the target, and three stats.
nonisolated struct LiftConsistency: Decodable, Equatable, Sendable {
    var caption: String
    var stats: [LiftConsistencyStat]
    /// Oldest first, each week Monday first.
    var heatmap: [LiftHeatmapWeek]
    var weeks: LiftWeekBars
}

nonisolated struct LiftConsistencyStat: Decodable, Equatable, Sendable, Identifiable {
    var id: String
    var value: String
    var label: String
}

nonisolated struct LiftHeatmapWeek: Decodable, Equatable, Sendable, Identifiable {
    var start: String
    var monthText: String?
    var days: [LiftHeatmapDay]

    var id: String { start }
}

nonisolated struct LiftHeatmapDay: Decodable, Equatable, Sendable, Identifiable {
    var date: String
    var sets: Double
    /// 0 none, 1 below 8 sets, 2 8+, 3 14+, 4 20+.
    var level: Int
    var future: Bool
    var today: Bool
    var sessionId: String?
    var label: String

    var id: String { date }
}

nonisolated struct LiftWeekBars: Decodable, Equatable, Sendable {
    var target: Int
    var scaleMax: Double
    var caption: String
    var items: [LiftWeekBar]
}

nonisolated struct LiftWeekBar: Decodable, Equatable, Sendable, Identifiable {
    var week: String
    var sessions: Int
    var sets: Double
    var met: Bool
    var label: String

    var id: String { week }
}

nonisolated struct LiftRecords: Decodable, Equatable, Sendable {
    var title: String
    var caption: String
    var emptyText: String
    var items: [LiftRecord]
}

nonisolated struct LiftRecord: Decodable, Equatable, Sendable, Identifiable {
    var exerciseKey: String
    var sessionId: String
    var name: String
    var date: String
    var detail: String
    var e1rmText: String
    var gainText: String?

    var id: String { "\(sessionId)-\(exerciseKey)" }
}

/// `GET /api/app/lift/weekly`: volume per week, newest first.
nonisolated struct LiftWeekly: Decodable, Equatable, Sendable {
    var unit: String
    var weeks: AppSection<LiftWeeklyWeeks>
}

nonisolated struct LiftWeeklyWeeks: Decodable, Equatable, Sendable {
    var title: String
    var caption: String
    var emptyText: String
    var items: [LiftWeeklyRow]
}

nonisolated struct LiftWeeklyRow: Decodable, Equatable, Sendable, Identifiable {
    var week: String
    var weekText: String
    var sessions: Int
    var sets: Double
    var volumeText: String
    /// Volume against the largest week, 0–1.
    var relative: Double

    var id: String { week }
}
