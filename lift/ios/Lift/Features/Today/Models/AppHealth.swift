import Foundation
import LiftSync

/// `GET /api/app/health?days=30|90` (lift/APP-API.md, "Health"): the web's Health page for the Today tab. Each section
/// loads on its own; every text is the server's.
nonisolated struct AppHealth: Decodable, Equatable, Sendable {
    static let path = "api/app/health"

    var today: PlainDay
    /// The trends' window: 30 or 90.
    var days: Int
    var status: AppSection<GarminStatus>
    var readiness: AppSection<HealthReadiness>
    var vitals: AppSection<HealthVitals>
    var trends: AppSection<HealthTrends>
    var body: AppSection<HealthBody>
    var labs: AppSection<HealthLabs>
    /// One sentence when there is no health data at all: shown in place of the sections.
    var emptyText: String?

    private enum Keys: String, CodingKey { case today, days, status, readiness, vitals, trends, body, labs, emptyText }

    /// A missing or broken section fails alone.
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        today = try container.decode(PlainDay.self, forKey: .today)
        days = try container.decode(Int.self, forKey: .days)
        status = container.section(.status)
        readiness = container.section(.readiness)
        vitals = container.section(.vitals)
        trends = container.section(.trends)
        body = container.section(.body)
        labs = container.section(.labs)
        emptyText = try container.decodeIfPresent(String.self, forKey: .emptyText)
    }
}

/// The Garmin line: when it synced, last night's sleep, and a warning worth showing.
nonisolated struct GarminStatus: Decodable, Equatable, Sendable {
    nonisolated struct Warning: Decodable, Equatable, Sendable {
        /// `warn` or `error`.
        var level: String
        var text: String
    }

    var connected: Bool
    /// "Garmin: synced 6 h ago, through Oct 22".
    var text: String
    /// "last night 6:50 asleep", "no watch last night", or nil when Garmin is not set up.
    var nightText: String?
    /// False for "no watch" and "waiting": the night text shows in amber.
    var nightIn: Bool
    var warning: Warning?
}

/// The readiness verdict: `good | ok | low | unknown`, its label and one sentence, and the reasons.
nonisolated struct HealthReadiness: Decodable, Equatable, Sendable {
    var status: String
    var label: String
    var text: String
    var flags: [String]
}

nonisolated struct HealthVitals: Decodable, Equatable, Sendable {
    /// "All within your normal", "Outside your normal: HRV low"; nil without samples.
    var summaryText: String?
    var items: [HealthVital]
}

/// One vital: the latest value against its normal range (mean ± 1 SD of the 60 days before it).
nonisolated struct HealthVital: Decodable, Equatable, Sendable, Identifiable {
    var key: String
    var label: String
    /// Nil without a value ("–").
    var valueText: String?
    /// "ms", "bpm", "h", "peak", "avg", "kg", or empty.
    var unit: String?
    /// "normal 48–56", "building normal", "No data", or the weight trend.
    var footText: String?
    /// The value's day ("Oct 19") when it is older than yesterday.
    var staleText: String?
    /// `below | above | inRange`, nil without a normal range.
    var status: String?
    /// Outside the normal range in the bad direction: the value is red.
    var isOff: Bool
    var range: HealthRangeBar?

    var id: String { key }
}

/// A range bar's scale: a track `min`…`max`, the normal range `low`…`high` shaded, a tick at `value`.
nonisolated struct HealthRangeBar: Decodable, Equatable, Sendable {
    var low: Double
    var high: Double
    var value: Double
    var min: Double
    var max: Double
}

nonisolated struct HealthTrends: Decodable, Equatable, Sendable {
    var items: [HealthTrend]
}

/// One metric over the window: the days with a value, the normal band and a goal line.
nonisolated struct HealthTrend: Decodable, Equatable, Sendable, Identifiable {
    var key: String
    var label: String
    var unit: String?
    var latestText: String?
    var normalText: String?
    var compareText: String?
    var recordedText: String?
    /// Oldest first.
    var points: [HealthPoint]
    /// Weight only: the smoothed trend, drawn as the line with `points` as dots.
    var trendLine: [HealthPoint]?
    var band: HealthBand?
    var goal: HealthGoal?
    var isOff: Bool

    var id: String { key }
}

nonisolated struct HealthPoint: Decodable, Equatable, Sendable, Identifiable {
    var date: PlainDay
    var value: Double

    var id: PlainDay { date }
}

nonisolated struct HealthBand: Decodable, Equatable, Sendable {
    var low: Double
    var high: Double
}

nonisolated struct HealthGoal: Decodable, Equatable, Sendable {
    var value: Double
    /// "goal 7:30".
    var label: String
}
