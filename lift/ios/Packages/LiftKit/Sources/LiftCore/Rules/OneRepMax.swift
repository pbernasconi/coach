import Foundation

/// Estimated one-rep max from a set of several reps.
public enum OneRepMax {
    public enum Formula: String, Hashable, Sendable, CaseIterable {
        /// `w × (1 + reps / 30)`
        case epley
        /// `w × 36 / (37 − reps)`
        case brzycki
    }

    /// Above this many reps the estimate is too unreliable to show.
    public static let maxReliableReps = 12

    /// The estimate for `reps` at `weight`, or nil when reps are outside 1…12 or the weight is not positive.
    /// A single rep is its own max under both formulas.
    public static func estimate(reps: Int, weight: Weight, formula: Formula = .epley) -> Weight? {
        guard reps > 0, reps <= maxReliableReps, weight.value > 0 else { return nil }
        guard reps > 1 else { return weight }
        let r = Double(reps)
        return switch formula {
        case .epley: weight.scaled(by: 1 + r / 30)
        case .brzycki: weight.scaled(by: 36 / (37 - r))
        }
    }

    /// The estimate for one logged set. Nil for warm-ups, sets not done, and bodyweight sets without
    /// added load (the logged weight of a bodyweight set is the added load).
    public static func estimate(set: LoggedSet, loadMode: LoadMode, formula: Formula = .epley) -> Weight? {
        guard set.isDone, set.kind != .warmUp, let actual = set.actual, let reps = actual.reps else { return nil }
        let weight: Weight? =
            if case .bodyweight(let added) = loadMode { actual.weight ?? added } else { actual.weight }
        guard let weight else { return nil }
        return estimate(reps: reps, weight: weight, formula: formula)
    }

    /// The highest estimate across `sets`, compared across units, in the unit of the set it came from.
    public static func best(in sets: [LoggedSet], loadMode: LoadMode, formula: Formula = .epley) -> Weight? {
        sets.compactMap { estimate(set: $0, loadMode: loadMode, formula: formula) }
            .max { $0.converted(to: .kg).value < $1.converted(to: .kg).value }
    }
}
