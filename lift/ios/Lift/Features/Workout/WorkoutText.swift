import Foundation
import LiftCore

/// Plain labels for the Workout screen: numbers and units, no commentary.
nonisolated enum WorkoutText {
    /// "62.5" or "100": up to two decimals.
    static func number(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)))
    }

    /// "62.5 kg".
    static func weight(_ weight: Weight) -> String {
        "\(number(weight.value)) \(weight.unit.rawValue)"
    }

    /// "8", "8–10", or nil when the target has no reps.
    static func reps(_ target: SetTarget) -> String? {
        if let reps = target.reps { return "\(reps)" }
        if let range = target.repRange { return "\(range.lowerBound)–\(range.upperBound)" }
        return nil
    }

    /// One set's target: "8 @ 60 kg", "8–10", "60 kg", or "No target".
    static func target(_ target: SetTarget) -> String {
        values(reps: reps(target), weight: target.weight) ?? String(localized: "No target")
    }

    /// An exercise's working target when every working set shares it: "3 × 8 @ 60 kg".
    static func exerciseTarget(sets: Int, target: SetTarget) -> String? {
        guard sets > 0, let text = values(reps: reps(target), weight: target.weight) else { return nil }
        return "\(sets) × \(text)"
    }

    /// Saved or logged values: "6 @ 62.5 kg", "6", "62.5 kg", or nil when there are none.
    static func values(reps: Int?, weight: Weight?) -> String? {
        values(reps: reps.map { "\($0)" }, weight: weight)
    }

    private static func values(reps: String?, weight: Weight?) -> String? {
        switch (reps, weight) {
        case (let reps?, let weight?): "\(reps) @ \(self.weight(weight))"
        case (let reps?, nil): reps
        case (nil, let weight?): self.weight(weight)
        case (nil, nil): nil
        }
    }

    /// "Warm-up: 20×10 · 50×5 · 70×3 · 85×1 kg", or nil when there is no ramp.
    static func warmUp(_ steps: [SetTarget], unit: WeightUnit) -> String? {
        let parts = steps.compactMap { step -> String? in
            guard let weight = step.weight, let reps = step.reps else { return nil }
            return "\(number(weight.converted(to: unit).value))×\(reps)"
        }
        guard !parts.isEmpty else { return nil }
        let ramp = parts.joined(separator: " · ")
        return String(localized: "Warm-up: \(ramp) \(unit.rawValue)")
    }

    /// "Per side: 25 + 15 · 20 kg bar", "Empty 20 kg bar", with "= 97.5 kg" when the target cannot be made exactly.
    static func plates(_ load: PlateLoad, bar: Double) -> String {
        let unit = load.total.unit
        let barText = "\(number(bar)) \(unit.rawValue)"
        var text =
            load.perSide.isEmpty
            ? String(localized: "Empty \(barText) bar")
            : String(localized: "Per side: \(load.perSide.map(number).joined(separator: " + ")) · \(barText) bar")
        if !load.isExact {
            text += " = \(weight(load.total))"
        }
        return text
    }

    /// The next session's target as plain numbers, or nil when there is nothing to judge from.
    static func progression(_ suggestion: ProgressionSuggestion) -> String? {
        switch suggestion {
        case .increase(let weight, let reps): String(localized: "Next time: \(reps) @ \(self.weight(weight))")
        case .repeatWeight(let reps): String(localized: "Next time: same weight, \(reps) reps")
        case .deload(let weight): String(localized: "Next time: \(self.weight(weight))")
        case .noHistory: nil
        }
    }

    /// A weight written down for next time.
    static func nextTimeHint(_ weight: Weight) -> String {
        String(localized: "Next time: \(self.weight(weight))")
    }

    /// "Set 2" for working sets, "Warm-up 1" and so on for the others.
    static func setTitle(number: Int, kind: SetKind) -> String {
        switch kind {
        case .working: String(localized: "Set \(number)")
        case .warmUp: String(localized: "Warm-up \(number)")
        case .drop: String(localized: "Drop set \(number)")
        case .failure: String(localized: "Set \(number) to failure")
        }
    }
}
