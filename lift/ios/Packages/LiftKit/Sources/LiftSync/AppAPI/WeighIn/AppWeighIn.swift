import Foundation

/// `GET /api/app/weigh-ins/{date | latest}` (lift/APP-API.md, "Weigh-in"): one day's weigh-in, what it changed, and
/// the 12-week trend. The screen a weigh-in notice opens.
public struct AppWeighIn: Decodable, Equatable, Sendable {
    public var date: PlainDay
    /// "Thursday, Oct 22".
    public var dateText: String
    public var weight: WeighInWeight
    public var bodyFat: WeighInBodyFat?
    /// Since the previous weigh-in, and over 4 weeks; either is left out when there is nothing to compare.
    public var changes: [WeighInChange]
    /// The smoothed trend as of `date`; nil from servers that predate it.
    public var trend: WeighInTrend?
    /// Each reading in the 12 weeks up to `date` with the trend through it, oldest first.
    public var series: [WeightPoint]
    /// "renpho", "garmin", "apple_health", …
    public var source: String?
    /// When the day's weight was stored (ISO 8601).
    public var recordedAt: String?
    public var newerDate: PlainDay?
    public var olderDate: PlainDay?

    /// The path of one day ("2026-10-22") or of the newest ("latest").
    public static func path(_ day: String) -> String { "api/app/weigh-ins/\(day)" }
}

public struct WeighInWeight: Decodable, Equatable, Sendable {
    public var kg: Double
    /// "83.2".
    public var text: String
    public var unit: String
}

public struct WeighInBodyFat: Decodable, Equatable, Sendable {
    public var pct: Double
    /// "18.4 %".
    public var text: String
}

public struct WeighInChange: Decodable, Equatable, Sendable, Identifiable {
    /// `previous` or `4w`.
    public var id: String
    /// "Since yesterday", "4 weeks".
    public var label: String
    public var kg: Double
    /// "▼ 0.3 kg".
    public var text: String
    /// `good` (down), `bad` (up) or `neutral`.
    public var tone: AppTone
    /// "83.5 kg on Oct 21".
    public var noteText: String?
}

/// The trend weight: an average that moves 10% of the way to each day's reading, so one salty dinner barely moves it.
public struct WeighInTrend: Decodable, Equatable, Sendable {
    public var kg: Double
    /// "83.3".
    public var text: String
    /// Over the last 2 weeks; nil with less than a week of readings.
    public var rate: WeighInRate?
    /// The reading minus the trend.
    public var offKg: Double
    /// The usual distance between a reading and the trend, at least 0.3 kg; nil with fewer than 5 readings.
    public var swingKg: Double?
    /// "Today is 0.4 kg under your trend, inside your normal ±0.6 kg day-to-day swing. …"; nil on a first reading.
    public var noteText: String?
}

public struct WeighInRate: Decodable, Equatable, Sendable {
    public var kgPerWeek: Double
    /// "▼ 0.26 kg/wk".
    public var text: String
    /// `good` (losing), `bad` (gaining) or `neutral`.
    public var tone: AppTone
}
