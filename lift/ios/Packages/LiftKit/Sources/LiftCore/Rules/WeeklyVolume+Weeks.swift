import Foundation

/// One week of training volume: hard sets per muscle and the week's total hard sets.
public struct WeekVolume: Hashable, Sendable, Identifiable {
    /// The week's first day.
    public let start: LocalDay
    /// Every muscle in `Muscle.allCases` order.
    public let muscles: [MuscleVolume]
    /// Every hard set logged in the week, matched to the library or not.
    public let hardSets: Int

    public var id: LocalDay { start }

    public init(start: LocalDay, muscles: [MuscleVolume], hardSets: Int) {
        self.start = start
        self.muscles = muscles
        self.hardSets = hardSets
    }
}

/// How much one exercise added to one muscle's weekly sets.
public struct MuscleContribution: Hashable, Sendable, Identifiable {
    /// The library exercise.
    public let exerciseID: UUID
    public let name: String
    /// Hard sets logged of the exercise.
    public let hardSets: Int
    /// What they count for the muscle: one each as a primary muscle, a half each as a secondary one.
    public let credit: Double
    /// Whether the muscle is one of the exercise's primary muscles.
    public let isPrimary: Bool

    public var id: UUID { exerciseID }

    public init(exerciseID: UUID, name: String, hardSets: Int, credit: Double, isPrimary: Bool) {
        self.exerciseID = exerciseID
        self.name = name
        self.hardSets = hardSets
        self.credit = credit
        self.isPrimary = isPrimary
    }
}

extension WeeklyVolume {
    /// The volume of each 7-day week starting on `starts`, in that order. Sessions outside every week are ignored.
    public static func weeks(sessions: [Session], library: [Exercise], starts: [LocalDay]) -> [WeekVolume] {
        starts.map { start in
            let week = sessions.filter { $0.date >= start && $0.date < start.adding(days: 7) }
            return WeekVolume(
                start: start,
                muscles: volume(sessions: week, library: library),
                hardSets: hardSets(in: week)
            )
        }
    }

    /// Every hard set in `sessions`, deleted sessions left out.
    public static func hardSets(in sessions: [Session]) -> Int {
        sessions.filter { $0.deletedAt == nil }
            .reduce(0) { total, session in total + session.allSets.filter(isHardSet).count }
    }

    /// The library exercises that added sets to `muscle` across `sessions`, most credit first, then by name.
    /// Exercises not matched to `library` add nothing, as in `volume(sessions:library:)`.
    public static func contributions(to muscle: Muscle, sessions: [Session], library: [Exercise])
        -> [MuscleContribution]
    {
        let byID = Dictionary(library.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var sets: [UUID: Int] = [:]
        for session in sessions where session.deletedAt == nil {
            for item in session.exercises {
                guard let id = item.exerciseID, let exercise = byID[id] else { continue }
                guard exercise.primary.contains(muscle) || exercise.secondary.contains(muscle) else { continue }
                sets[id, default: 0] += item.sets.filter(isHardSet).count
            }
        }
        return sets.compactMap { id, count -> MuscleContribution? in
            guard count > 0, let exercise = byID[id] else { return nil }
            let isPrimary = exercise.primary.contains(muscle)
            let credit = Double(count) * (isPrimary ? primaryCredit : secondaryCredit)
            return MuscleContribution(
                exerciseID: id,
                name: exercise.name,
                hardSets: count,
                credit: credit,
                isPrimary: isPrimary
            )
        }
        .sorted { ($1.credit, $0.name) < ($0.credit, $1.name) }
    }
}
