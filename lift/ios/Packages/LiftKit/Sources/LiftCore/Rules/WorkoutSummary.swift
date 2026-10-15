import Foundation

/// The numbers shown when a workout is finished: no commentary, numbers only.
public struct WorkoutSummary: Hashable, Sendable {
    /// From the start (or the first logged set) to the finish (or the last logged set); nil when unknown.
    public var duration: TimeInterval?
    /// Done sets, warm-ups included.
    public var setsLogged: Int
    /// Reps × load over the done sets that are not warm-ups (see `WorkoutSummarizer.volume`).
    public var volume: Weight
    /// Records broken in this workout, in exercise order.
    public var bests: [PersonalBest]

    public init(duration: TimeInterval?, setsLogged: Int, volume: Weight, bests: [PersonalBest]) {
        self.duration = duration
        self.setsLogged = setsLogged
        self.volume = volume
        self.bests = bests
    }
}

/// One exercise's records beaten in a workout: a heavier set than ever logged before, a higher estimated one-rep max,
/// or both. One per exercise, so the summary lists each exercise once.
public struct PersonalBest: Hashable, Sendable {
    /// A new record and the best before this workout.
    public struct Record: Hashable, Sendable {
        public var value: Weight
        public var previous: Weight

        public init(value: Weight, previous: Weight) {
            self.value = value
            self.previous = previous
        }
    }

    /// The set the summary shows under the headline: its load and reps.
    public struct TopSet: Hashable, Sendable {
        /// Nil for a bodyweight set with no added load.
        public var weight: Weight?
        public var reps: Int

        public init(weight: Weight?, reps: Int) {
            self.weight = weight
            self.reps = reps
        }
    }

    public var exerciseID: UUID
    public var exerciseName: String
    /// The heaviest set when it beat every earlier one; nil when it did not.
    public var heaviest: Record?
    /// The best estimated one-rep max when it beat the earlier best (both rounded, see `WorkoutBests.estimateStep`);
    /// nil when it did not.
    public var estimatedOneRepMax: Record?
    /// The heaviest set when it is a record, otherwise the set behind the best estimate.
    public var topSet: TopSet
    /// The workout's best estimated one-rep max, rounded; nil when no set gives one (more than 12 reps).
    public var estimate: Weight?

    public init(
        exerciseID: UUID,
        exerciseName: String,
        heaviest: Record?,
        estimatedOneRepMax: Record?,
        topSet: TopSet,
        estimate: Weight?
    ) {
        self.exerciseID = exerciseID
        self.exerciseName = exerciseName
        self.heaviest = heaviest
        self.estimatedOneRepMax = estimatedOneRepMax
        self.topSet = topSet
        self.estimate = estimate
    }
}
