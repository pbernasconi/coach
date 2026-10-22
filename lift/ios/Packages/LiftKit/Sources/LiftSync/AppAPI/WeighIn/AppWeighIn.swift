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
    /// The 12 weeks up to `date`, oldest first.
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
