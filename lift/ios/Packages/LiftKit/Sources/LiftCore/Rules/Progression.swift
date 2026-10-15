import Foundation

/// Double progression: build reps across the range at one weight, then add weight.
public enum Progression {
    /// The share of the working weight kept on a deload.
    public static let deloadFactor = 0.9

    /// Suggests the next target from the last session's sets (and the one before, for deloads).
    /// Warm-up and drop sets are ignored. A set of kind `.failure`, or any working set skipped or not done,
    /// blocks an increase. For a bodyweight lift (no weight logged) an increase means adding one increment.
    public static func suggest(
        repRange: ClosedRange<Int>,
        last: [LoggedSet],
        previous: [LoggedSet] = [],
        increment: Weight
    ) -> ProgressionSuggestion {
        let working = workingSets(last)
        guard !working.isEmpty else { return .noHistory }
        let weight = heaviest(working)
        if fellBelow(repRange, in: working), fellBelow(repRange, in: workingSets(previous)) {
            guard let weight else { return .repeatWeight(targetReps: repRange.lowerBound) }
            let reduced = weight.scaled(by: deloadFactor).rounded(to: increment, rule: .down)
            return .deload(to: Weight(max(0, reduced.value), weight.unit))
        }
        if hitTop(repRange, in: working) {
            let base = weight ?? Weight(0, increment.unit)
            return .increase(to: base.adding(increment), targetReps: repRange.lowerBound)
        }
        let fewest = working.filter(\.isDone).compactMap { $0.actual?.reps }.min()
        let next = (fewest ?? repRange.lowerBound - 1) + 1
        return .repeatWeight(targetReps: min(max(next, repRange.lowerBound), repRange.upperBound))
    }

    private static func workingSets(_ sets: [LoggedSet]) -> [LoggedSet] {
        sets.filter { $0.kind == .working || $0.kind == .failure }
    }

    private static func heaviest(_ sets: [LoggedSet]) -> Weight? {
        sets.compactMap { $0.actual?.weight ?? $0.target.weight }
            .max { $0.converted(to: .kg).value < $1.converted(to: .kg).value }
    }

    private static func fellBelow(_ range: ClosedRange<Int>, in sets: [LoggedSet]) -> Bool {
        sets.contains { $0.isDone && ($0.actual?.reps ?? 0) < range.lowerBound }
    }

    private static func hitTop(_ range: ClosedRange<Int>, in sets: [LoggedSet]) -> Bool {
        sets.allSatisfy { $0.isDone && $0.kind == .working && ($0.actual?.reps ?? 0) >= range.upperBound }
    }
}
