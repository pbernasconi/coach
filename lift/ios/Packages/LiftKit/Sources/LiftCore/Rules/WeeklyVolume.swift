import Foundation

/// Hard sets per muscle in a week, against the commonly cited 10–20 sets per muscle per week band.
public enum WeeklyVolume {
    /// The target band of weekly hard sets per muscle.
    public static let targetSets: ClosedRange<Double> = 10...20
    /// A set counts this much for each primary muscle of its exercise.
    public static let primaryCredit = 1.0
    /// A set counts this much for each secondary muscle of its exercise.
    public static let secondaryCredit = 0.5

    /// A hard set is a done working, failure or drop set. Warm-ups never count.
    public static func isHardSet(_ set: LoggedSet) -> Bool {
        set.isDone && set.kind != .warmUp
    }

    public static func status(forHardSets sets: Double) -> VolumeStatus {
        if sets < targetSets.lowerBound { return .below }
        if sets > targetSets.upperBound { return .above }
        return .inRange
    }

    /// Volume for every muscle (in `Muscle.allCases` order) across `sessions`, which the caller limits to
    /// one week. Deleted sessions and exercises not matched to `library` are ignored.
    public static func volume(sessions: [Session], library: [Exercise]) -> [MuscleVolume] {
        let byID = Dictionary(library.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var totals: [Muscle: Double] = [:]
        for session in sessions where session.deletedAt == nil {
            for item in session.exercises {
                guard let id = item.exerciseID, let exercise = byID[id] else { continue }
                let hard = Double(item.sets.filter(isHardSet).count)
                for muscle in exercise.primary { totals[muscle, default: 0] += hard * primaryCredit }
                for muscle in exercise.secondary { totals[muscle, default: 0] += hard * secondaryCredit }
            }
        }
        return Muscle.allCases.map { muscle in
            let sets = totals[muscle] ?? 0
            return MuscleVolume(muscle: muscle, hardSets: sets, status: status(forHardSets: sets))
        }
    }
}
