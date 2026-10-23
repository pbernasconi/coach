import Foundation
import LiftSync

// The simple overview's sections (lift/APP-API.md, "The simple overview"): this week in one line, the focus muscles
// and how this week's sessions target them, and each focus lift's 8-week trend. Server-made; nil from older servers.

/// "1 of 2 sessions this week" and the next session.
nonisolated struct LiftSummary: Decodable, Equatable, Sendable {
    var text: String
    var done: Int
    var target: Int
    /// 0–1.
    var progress: Double
    var next: LiftNext?
    var nextEmptyText: String
}

/// Each focus muscle this week: sets done and still planned against the 10–20 band, and the sessions that hit it.
nonisolated struct LiftTargeting: Decodable, Equatable, Sendable {
    var caption: String
    var band: LiftBand
    var scaleMax: Double
    var items: [LiftTargetMuscle]
    var emptyText: String
}

nonisolated struct LiftTargetMuscle: Decodable, Equatable, Sendable, Identifiable {
    var muscle: String
    var name: String
    var done: Double
    var planned: Double
    /// `inRange | above | onTrack | below`.
    var status: String
    /// "3 done · 4 planned".
    var text: String
    var label: String
    var sessions: [LiftTargetSession]

    var id: String { muscle }
}

nonisolated struct LiftTargetSession: Decodable, Equatable, Sendable, Identifiable {
    var sessionId: String
    /// "Fri".
    var dayText: String
    var title: String
    var sets: Double
    /// "4 sets".
    var setsText: String
    /// Logged already (else still planned).
    var done: Bool

    var id: String { sessionId }
}

/// Each focus lift: its estimated 1RM now, the change over 8 weeks and the points for a small trend line.
nonisolated struct LiftProgress: Decodable, Equatable, Sendable {
    var caption: String
    var items: [LiftProgressLift]
    var emptyText: String
}

nonisolated struct LiftProgressLift: Decodable, Equatable, Sendable, Identifiable {
    var exerciseKey: String
    var name: String
    var e1rm: Double?
    /// "117 kg".
    var e1rmText: String
    /// "+6% since Sep 28".
    var changeText: String?
    /// `up | down | same`.
    var tone: String
    var points: [LiftProgressPoint]
    /// "PR Oct 19".
    var prText: String?
    var emptyText: String?

    var id: String { exerciseKey }
}

nonisolated struct LiftProgressPoint: Decodable, Equatable, Sendable {
    var date: String
    var e1rm: Double
}

/// The one coach note worth a line, or none.
nonisolated struct LiftNote: Decodable, Equatable, Sendable {
    var item: LiftTip?
}
