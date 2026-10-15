import Foundation
import LiftCore

/// Plain labels for the workout summary: numbers and units, no commentary.
nonisolated enum WorkoutSummaryText {
    /// "52 min" or "1 hr, 5 min".
    static func duration(_ seconds: TimeInterval) -> String {
        let minutes = max(1, Int((seconds / 60).rounded()))
        return Duration.seconds(minutes * 60).formatted(.units(allowed: [.hours, .minutes], width: .abbreviated))
    }

    /// "4,250": whole numbers.
    static func volume(_ weight: Weight) -> String {
        weight.value.formatted(.number.precision(.fractionLength(0)))
    }

    /// One best: "Estimated 1RM · was 116.7 kg" and "122.5 kg".
    static func best(_ best: PersonalBest, unit: WeightUnit) -> WorkoutBestItem {
        let kind =
            switch best.kind {
            case .estimatedOneRepMax: String(localized: "Estimated 1RM")
            case .weight: String(localized: "Heaviest set")
            }
        let previous = weight(best.previous, unit: unit)
        return WorkoutBestItem(
            id: "\(best.exerciseID.uuidString)-\(best.kind.rawValue)",
            exercise: best.exerciseName,
            detail: String(localized: "\(kind) · was \(previous)"),
            value: weight(best.value, unit: unit)
        )
    }

    /// A load in `unit`, to a tenth.
    private static func weight(_ weight: Weight, unit: WeightUnit) -> String {
        WorkoutText.weight(weight.converted(to: unit).rounded(toStep: 0.1))
    }
}
