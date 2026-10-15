import Foundation
import LiftCore

/// Plain labels for the History tab's Progress view: numbers and units, no commentary.
nonisolated enum HistoryVolumeText {
    /// "7.5" or "12": hard sets, to the half.
    static func sets(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)))
    }

    /// "24 hard sets", "1 hard set".
    static func hardSets(_ value: Double) -> String {
        value == 1 ? String(localized: "1 hard set") : String(localized: "\(sets(value)) hard sets")
    }

    /// "10–20 sets per muscle", the band the bars are drawn against.
    static var band: String {
        let band = WeeklyVolume.targetSets
        return String(localized: "Band: \(sets(band.lowerBound))–\(sets(band.upperBound)) sets per muscle")
    }

    /// "Primary · 3 sets" or "Secondary · 4 sets at half credit".
    static func contribution(hardSets: Int, isPrimary: Bool) -> String {
        let count = hardSets == 1 ? String(localized: "1 set") : String(localized: "\(hardSets) sets")
        return isPrimary
            ? String(localized: "Primary · \(count)")
            : String(localized: "Secondary · \(count) at half credit")
    }

    /// "7.5 hard sets, below 10 to 20" for VoiceOver.
    static func accessibilityValue(_ volume: MuscleVolume) -> String {
        let band = WeeklyVolume.targetSets
        let range = "\(sets(band.lowerBound)) to \(sets(band.upperBound))"
        let place: String =
            switch volume.status {
            case .below: String(localized: "below \(range)")
            case .inRange: String(localized: "within \(range)")
            case .above: String(localized: "above \(range)")
            }
        return "\(hardSets(volume.hardSets)), \(place)"
    }

    /// "Week of Oct 4: 16 hard sets." per trend week, for VoiceOver.
    static func trendSummary(_ bars: [VolumeTrendBar], days: DayCalendar) -> String {
        bars.map { bar in
            "\(days.weekTitle(start: bar.id)): \(hardSets(Double(bar.sets)))."
        }
        .joined(separator: " ")
    }
}
