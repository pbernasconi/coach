import Foundation
import LiftSync

/// `GET /api/app/lift/sessions/{id}`: one session, read-only, with its neighbours.
nonisolated struct LiftSessionDetail: Decodable, Equatable, Sendable {
    var id: String
    var unit: String
    var olderId: String?
    var newerId: String?
    var hero: AppSection<LiftSessionHero>
    var exercises: AppSection<LiftSessionExercises>
    /// The Strava activity the watch recorded for this lift; nil when there is none (or an older server).
    var watch: AppSection<LiftWatch>?
    /// "How did it feel"; nil when it did not load.
    var feedback: WorkoutFeedback?
}

nonisolated struct LiftSessionHero: Decodable, Equatable, Sendable {
    var kicker: String
    var date: String
    var dateText: String
    var startText: String?
    var title: String
    var note: String?
    /// `planned`, `inProgress` or `done`.
    var state: String
    var stateLabel: String
    /// Always 5.
    var stats: [LiftStat]
    var ring: LiftRing
    /// Up to 8, most sets first.
    var muscles: [LiftSessionMuscle]
    /// The page's headline numbers, at most 6 (duration, sets, the watch's heart rate…); nil from an older server.
    var summary: [ActivityOverview.Stat]?
    /// The watch activity, for its full page.
    var watchActivityId: String?
}

nonisolated struct LiftRing: Decodable, Equatable, Sendable {
    var logged: Int
    var total: Int
    var progress: Double
    var text: String
    var caption: String
}

nonisolated struct LiftSessionMuscle: Decodable, Equatable, Sendable, Identifiable {
    var muscle: String
    var name: String
    var setsText: String
    /// Against the first muscle, 0–1.
    var relative: Double

    var id: String { muscle }
}

nonisolated struct LiftSessionExercises: Decodable, Equatable, Sendable {
    var emptyText: String
    var items: [LiftSessionExercise]
}

nonisolated struct LiftSessionExercise: Decodable, Equatable, Sendable, Identifiable {
    var id: String
    var exerciseKey: String
    var indexText: String
    var name: String
    var setsText: String
    var complete: Bool
    var muscles: [String]
    var secondaryMuscles: [String]
    var equipment: String?
    var loadNote: String?
    var restText: String?
    var note: String?
    var sets: [LiftSessionSet]
    var lastTime: LiftLastTime?
    var lastTimeEmptyText: String?
    var best: LiftBest?
    var trend: LiftTrend?
    var steps: [String]
    var media: LiftMedia?
    /// What was done and how it compares; nil from an older server.
    var result: LiftExerciseResult?
}

/// One exercise's result (lift/APP-API.md, "Session"): the done sets as one line, the top set, the e1RM against last
/// time, a record, and the e1RM of the last sessions ending with this one.
nonisolated struct LiftExerciseResult: Decodable, Equatable, Sendable {
    /// `done`, `skipped` or `planned`.
    var state: String
    var summaryText: String
    var topSetText: String?
    var e1rmText: String?
    var change: Change?
    var record: Bool
    var progress: LiftTrend?

    nonisolated struct Change: Decodable, Equatable, Sendable {
        var text: String
        /// `up`, `down` or `same`.
        var tone: String
        var caption: String
    }
}

/// The watch's recording of the lift: its numbers, the heart rate on its clock, and the time in each zone.
nonisolated struct LiftWatch: Decodable, Equatable, Sendable {
    var activityId: String
    var name: String?
    var deviceText: String?
    var stats: [ActivityOverview.Stat]
    var heartRate: HeartRate?
    var zones: [ActivityZones.Zone]?
    var note: String?

    nonisolated struct HeartRate: Decodable, Equatable, Sendable {
        var timeS: [Double]
        var values: [Double?]
        var avgText: String?
        var maxText: String?
    }
}

nonisolated struct LiftSessionSet: Decodable, Equatable, Sendable, Identifiable {
    var id: String
    var label: String
    /// `warmup` or `working` (and the other set kinds).
    var kind: String
    /// `planned`, `done` or `skipped`.
    var status: String
    var text: String
    var targetText: String?
    var beatTarget: Bool
    var rpeText: String?
    var note: String?

    /// The server sends Lift's `warmUp`; older bodies wrote `warmup`.
    var isWarmUp: Bool { kind.lowercased() == "warmup" }
}

nonisolated struct LiftLastTime: Decodable, Equatable, Sendable {
    var sessionId: String
    var date: String
    var title: String
    var deltaText: String?
    var sets: [String]
}

nonisolated struct LiftBest: Decodable, Equatable, Sendable {
    var e1rm: Double
    var text: String
    var dateText: String
}

nonisolated struct LiftTrend: Decodable, Equatable, Sendable {
    var values: [Double]
    var caption: String
}

nonisolated struct LiftMedia: Decodable, Equatable, Sendable {
    var image: URL?
    var gif: URL?
}
