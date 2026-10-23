import Foundation

public struct TodayBody: Decodable, Equatable, Sendable {
    public var weight: TodayWeight?
    /// Each reading in the last 12 weeks with its trend, for the trend line.
    public var series: [WeightPoint]
    public var bodyFatText: String?
    /// Set when there is no weight in 12 weeks.
    public var emptyText: String?
}

public struct TodayWeight: Decodable, Equatable, Sendable {
    public var date: PlainDay
    /// "78.4".
    public var text: String
    public var unit: String
    /// The trend's rate, "▼ 0.26 kg/wk" (or the 4-week change, "▼ 1.2 kg", before there is a rate).
    public var changeText: String?
    public var changeTone: AppTone?
    /// "Trend 78.9 kg · ▼ 1.2 kg in 4 weeks".
    public var noteText: String?
}

public struct WeightPoint: Decodable, Equatable, Sendable {
    public var date: PlainDay
    /// The scale's reading.
    public var kg: Double
    /// The trend through this reading; nil from servers that predate it.
    public var trendKg: Double?
}

public struct TodayLift: Decodable, Equatable, Sendable {
    public var unit: String
    public var hasData: Bool
    public var arms: TodayArms?
    public var mainLifts: [AppMainLift]
    public var mainLiftsEmptyText: String?
    public var strength: TodayStrength?
    public var last: TodayLastLift?
    public var next: TodayNextLift?
    /// "Not planned yet" when there is no next lift.
    public var nextEmptyText: String?
}

/// Biceps and triceps hard sets this week against the target band.
public struct TodayArms: Decodable, Equatable, Sendable {
    public var band: AppBand
    /// "target 10–20".
    public var bandText: String
    public var rows: [TodayArmRow]
}

public struct AppBand: Decodable, Equatable, Sendable {
    public var min: Double
    public var max: Double
}

public struct TodayArmRow: Decodable, Equatable, Sendable, Identifiable {
    public var muscle: String
    public var sets: Double
    public var setsText: String

    public var id: String { muscle }
}

/// One of the most-done lifts: e1RM per session, latest value and change. Today and Trends send the same shape.
public struct AppMainLift: Decodable, Equatable, Sendable, Identifiable {
    /// Opens `/api/app/lift/exercises/{key}`.
    public var exerciseKey: String
    public var name: String
    public var points: [E1RMPoint]
    public var latestText: String?
    public var changeText: String?
    public var tone: AppTone?
    /// "1 session" when there is one point (no line).
    public var sparkText: String?

    public var id: String { exerciseKey }
}

public struct E1RMPoint: Decodable, Equatable, Sendable {
    public var day: PlainDay
    public var e1rm: Double
}

public struct TodayStrength: Decodable, Equatable, Sendable {
    public var done: Int
    public var target: Int
    /// "0 / 2 this week".
    public var text: String
}

public struct TodayLastLift: Decodable, Equatable, Sendable {
    public var sessionId: String
    /// "21 days ago".
    public var whenText: String
    /// 10 days or more: the web shows it in red.
    public var late: Bool
    /// The title, plus " · 2 PRs".
    public var text: String
}

public struct TodayNextLift: Decodable, Equatable, Sendable {
    public var sessionId: String
    /// "Oct 20".
    public var dateText: String
    public var title: String
}

public struct TodayGoals: Decodable, Equatable, Sendable {
    public var items: [TodayGoal]
    public var emptyText: String?
}

public struct TodayGoal: Decodable, Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    /// `done | open | on_track | behind | not_started | missed`.
    public var status: String
    public var statusText: String
    public var currentText: String?
    public var targetText: String?
    /// "224 days left · 2027-06-01".
    public var timeText: String?
    /// 0–1, the bar's width.
    public var progress: Double?
    /// Lines under the bar.
    public var detail: [String]
}
