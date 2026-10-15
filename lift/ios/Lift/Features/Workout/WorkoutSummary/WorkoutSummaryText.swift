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

    /// One exercise's records as one row: the headline is the heavier set when there is one, otherwise the estimate;
    /// the detail is the set behind it and the estimated 1RM, "65 kg × 5 · est. 1RM 76 kg (was 73)".
    static func best(_ best: PersonalBest, unit: WeightUnit) -> WorkoutBestItem {
        let headline = best.heaviest?.value ?? best.estimatedOneRepMax?.value ?? best.estimate
        return WorkoutBestItem(
            id: best.exerciseID.uuidString,
            exercise: best.exerciseName,
            detail: detail(best, unit: unit),
            value: headline.map { weight($0, unit: unit) } ?? ""
        )
    }

    /// "65 kg × 5 · est. 1RM 76 kg (was 73)"; the estimate part is left out when no set gives one.
    static func detail(_ best: PersonalBest, unit: WeightUnit) -> String {
        let reps = best.topSet.reps
        let set =
            best.topSet.weight.map { String(localized: "\(weight($0, unit: unit)) × \(reps)") }
            ?? String(localized: "Bodyweight × \(reps)")
        guard let estimate = best.estimate.map({ weight($0, unit: unit) }) else { return set }
        guard let previous = best.estimatedOneRepMax?.previous else {
            return String(localized: "\(set) · est. 1RM \(estimate)")
        }
        let was = WorkoutText.number(previous.converted(to: unit).rounded(toStep: WorkoutBests.estimateStep).value)
        return String(localized: "\(set) · est. 1RM \(estimate) (was \(was))")
    }

    /// A load in `unit`, to a tenth.
    private static func weight(_ weight: Weight, unit: WeightUnit) -> String {
        WorkoutText.weight(weight.converted(to: unit).rounded(toStep: 0.1))
    }
}
