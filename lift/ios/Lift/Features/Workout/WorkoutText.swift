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

    /// The set badge: "2" for a working set, "W", "D" or "F" for warm-up, drop and failure sets.
    static func badge(number: Int, kind: SetKind) -> String {
        switch kind {
        case .working: "\(number)"
        case .warmUp: String(localized: "W", comment: "Badge of a warm-up set")
        case .drop: String(localized: "D", comment: "Badge of a drop set")
        case .failure: String(localized: "F", comment: "Badge of a set to failure")
        }
    }

    /// A weight pill in the set's unit without the unit ("87.5"), or "—" when there is none.
    static func pill(_ weight: Weight?, unit: WeightUnit) -> String {
        weight.map { number($0.converted(to: unit).value) } ?? "—"
    }

    /// A reps pill: the saved reps, otherwise the target ("5", "8–10"), or "—".
    static func pill(reps: Int?, target: SetTarget) -> String {
        reps.map { "\($0)" } ?? self.reps(target) ?? "—"
    }

    /// The same set last time, in the set's unit: "5 × 85", "5", "85", or nil when nothing was logged.
    static func previous(_ set: PreviousSet, unit: WeightUnit) -> String? {
        let weight = set.weight.map { number($0.converted(to: unit).value) }
        switch (set.reps, weight) {
        case (let reps?, let weight?): return "\(reps) × \(weight)"
        case (let reps?, nil): return "\(reps)"
        case (nil, let weight?): return weight
        case (nil, nil): return nil
        }
    }

    /// "Last time 5 × 85 kg · Fri, Oct 9" for the editor, or nil when nothing was logged.
    static func lastTime(_ set: PreviousSet, unit: WeightUnit, day: String) -> String? {
        guard let values = previous(set, unit: unit) else { return nil }
        let text = set.weight == nil ? values : "\(values) \(unit.rawValue)"
        return String(localized: "Last time \(text) · \(day)")
    }
}
