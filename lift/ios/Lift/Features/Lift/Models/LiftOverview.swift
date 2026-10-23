import Foundation
import LiftSync

/// `GET /api/app/lift`: the web's /lift page, every number and label made on the server (lift/APP-API.md).
nonisolated struct LiftOverview: Decodable, Equatable, Sendable {
    var today: String
    var unit: String
    /// Not nil when no session is logged: shown in place of every section.
    var empty: LiftEmpty?
    /// The simple overview the page shows; nil from a server that does not send them yet.
    var summary: AppSection<LiftSummary>?
    var targeting: AppSection<LiftTargeting>?
    var progress: AppSection<LiftProgress>?
    var note: AppSection<LiftNote>?
    var week: AppSection<LiftWeek>
    var tips: AppSection<LiftTips>
    var lifts: AppSection<LiftMainLifts>
    var muscles: AppSection<LiftMuscles>
    var sessions: AppSection<LiftSessions>
    var exercises: AppSection<LiftExerciseIndex>
    var consistency: AppSection<LiftConsistency>
    var records: AppSection<LiftRecords>
}

nonisolated struct LiftEmpty: Decodable, Equatable, Sendable {
    var title: String
    var body: String
}

/// This week: done against the target, the seven days, four stats and the next session.
nonisolated struct LiftWeek: Decodable, Equatable, Sendable {
    var title: String
    var done: Int
    var target: Int
    var doneText: String
    var caption: String
    /// 0–1.
    var progress: Double
    var targetMet: Bool
    /// Always 7, Monday first.
    var days: [LiftWeekDay]
    /// Always 4.
    var stats: [LiftStat]
    var next: LiftNext?
    var nextEmptyText: String
}

nonisolated struct LiftWeekDay: Decodable, Equatable, Sendable, Identifiable {
    var date: String
    var letter: String
    /// `done`, `planned` or `none`.
    var state: String
    var today: Bool
    var sessionId: String?
    var label: String

    var id: String { date }
}

nonisolated struct LiftNext: Decodable, Equatable, Sendable {
    var sessionId: String
    var date: String
    var title: String
    var whenText: String
    var detail: String
}

nonisolated struct LiftTips: Decodable, Equatable, Sendable {
    var title: String
    var items: [LiftTip]
}

nonisolated struct LiftTip: Decodable, Equatable, Sendable, Identifiable {
    var id: String
    /// `good`, `warn` or `info` (unknown tones read as neutral).
    var tone: AppTone
    var title: String
    var body: String
    /// Nil for no link, and for a link kind this app does not know (the tip still shows, without a link).
    var link: LiftLink?

    private enum Key: String, CodingKey { case id, tone, title, body, link }

    init(id: String, tone: AppTone, title: String, body: String, link: LiftLink?) {
        self.id = id
        self.tone = tone
        self.title = title
        self.body = body
        self.link = link
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Key.self)
        id = try container.decode(String.self, forKey: .id)
        tone = try container.decode(AppTone.self, forKey: .tone)
        title = try container.decode(String.self, forKey: .title)
        body = try container.decode(String.self, forKey: .body)
        link = (try? container.decodeIfPresent(LiftLink.self, forKey: .link)) ?? nil
    }
}

/// The main lifts of 12 weeks, each with its e1RM per session.
nonisolated struct LiftMainLifts: Decodable, Equatable, Sendable {
    var caption: String
    var emptyText: String
    var items: [LiftMainLift]
}

nonisolated struct LiftMainLift: Decodable, Equatable, Sendable, Identifiable {
    var exerciseKey: String
    var name: String
    var sessions: Int
    var sessionsText: String
    var newBest: Bool
    var e1rm: Double?
    var e1rmText: String?
    var change: Double?
    var changeText: String?
    /// The all-time best e1RM: the dashed line.
    var best: Double?
    /// Oldest first, at most 16.
    var points: [LiftE1RMPoint]
    /// Not nil with fewer than 2 points: shown in place of the chart.
    var chartEmptyText: String?
    var lastText: String?
    var bestText: String?

    var id: String { exerciseKey }
}

nonisolated struct LiftE1RMPoint: Decodable, Equatable, Sendable, Identifiable {
    var date: String
    var sessionId: String
    var e1rm: Double
    var label: String

    var id: String { "\(sessionId)-\(date)" }
}

/// Hard sets per muscle this week, against the 10–20 band, with the 4-week average as a tick.
nonisolated struct LiftMuscles: Decodable, Equatable, Sendable {
    var title: String
    var caption: String
    var band: LiftBand
    var scaleMax: Double
    var arms: [LiftMuscle]
    var other: [LiftMuscle]
}

nonisolated struct LiftBand: Decodable, Equatable, Sendable {
    var min: Double
    var max: Double
}

nonisolated struct LiftMuscle: Decodable, Equatable, Sendable, Identifiable {
    var muscle: String
    var name: String
    var week: Double
    var weekText: String
    var avg: Double
    var avgText: String
    /// `below`, `inRange` or `above`.
    var status: String
    var label: String

    var id: String { muscle }
}
