import Foundation
import LiftSync

/// The newest weigh-in and the newest DEXA scan.
nonisolated struct HealthBody: Decodable, Equatable, Sendable {
    var weight: HealthWeight?
    var dexa: HealthDexa?
}

nonisolated struct HealthWeight: Decodable, Equatable, Sendable {
    var kg: Double
    /// "83.6".
    var valueText: String
    var unit: String
    var dateText: String
    /// "trend 83.9 · ▼ 0.07/wk".
    var trendText: String?
    /// "▼ 0.7 kg in 4 weeks", nil without a weigh-in 4 weeks back.
    var change4wText: String?
}

nonisolated struct HealthDexa: Decodable, Equatable, Sendable {
    /// "Sep 15, 2026".
    var dateText: String
    var location: String?
    var scanCount: Int
    /// Body fat, lean mass, visceral fat, fat mass, when present.
    var measures: [HealthDexaMeasure]
}

nonisolated struct HealthDexaMeasure: Decodable, Equatable, Sendable, Identifiable {
    var key: String
    var label: String
    var valueText: String
    var unit: String
    /// "▼ 0.7 pts since last", nil on a first scan.
    var changeText: String?
    /// `good | bad | neutral`.
    var tone: AppTone?

    var id: String { key }
}

/// The newest lab draw: counts and the out-of-range biomarkers.
nonisolated struct HealthLabs: Decodable, Equatable, Sendable {
    nonisolated struct Counts: Decodable, Equatable, Sendable {
        var total: Int
        var inRange: Int
        var outOfRange: Int
        var noRange: Int
    }

    /// Nil with no results.
    var drawDateText: String?
    var drawCount: Int
    var counts: Counts
    /// At most 8, by category then name.
    var items: [HealthLabItem]
    /// The out-of-range biomarkers past the first 8.
    var moreCount: Int
}

nonisolated struct HealthLabItem: Decodable, Equatable, Sendable, Identifiable {
    var name: String
    var valueText: String
    var unit: String?
    /// "30–100", "≤ 90", "≥ 40".
    var rangeText: String?
    var status: String
    /// "Out of range".
    var statusText: String

    var id: String { name }
}
