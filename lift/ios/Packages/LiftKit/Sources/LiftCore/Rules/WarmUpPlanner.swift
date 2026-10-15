import Foundation

/// Barbell warm-up ramps: empty bar ×10, then about 50% ×5, 70% ×3 and 85% ×1.
public enum WarmUpPlanner {
    /// Working weights below these get no ramp.
    public static let minimumWorking: [WeightUnit: Double] = [.lb: 135, .kg: 60]

    /// The ramp: fraction of the working weight (nil means the empty bar) and reps.
    private static let steps: [(fraction: Double?, reps: Int)] = [(nil, 10), (0.5, 5), (0.7, 3), (0.85, 1)]

    /// Warm-up targets for a working weight, each rounded to the nearest loadable weight, with duplicates
    /// removed and nothing at or above the working weight. Empty for non-barbell or light lifts.
    public static func plan(working: Weight, equipment: Equipment, plates: PlateSet? = nil) -> [SetTarget] {
        let set = plates ?? .standard(working.unit)
        let workingValue = working.converted(to: set.unit).value
        let threshold = (minimumWorking[working.unit] ?? 0)
        guard equipment == .barbell, working.value >= threshold, workingValue > set.bar else { return [] }
        var targets: [SetTarget] = []
        for step in steps {
            let weight: Weight =
                if let fraction = step.fraction {
                    PlateMath.nearestLoadable(to: Weight(workingValue * fraction, set.unit), using: set).total
                } else {
                    Weight(set.bar, set.unit)
                }
            guard weight.value < workingValue - 1e-9, weight != targets.last?.weight else { continue }
            targets.append(SetTarget(reps: step.reps, weight: weight))
        }
        return targets
    }
}
