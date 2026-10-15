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

/// A record beaten in a workout: a higher estimated one-rep max, or a heavier load than ever logged before.
public struct PersonalBest: Hashable, Sendable {
    public enum Kind: String, Hashable, Sendable {
        case estimatedOneRepMax
        case weight
    }

    public var exerciseID: UUID
    public var exerciseName: String
    public var kind: Kind
    public var value: Weight
    /// The best before this workout.
    public var previous: Weight

    public init(exerciseID: UUID, exerciseName: String, kind: Kind, value: Weight, previous: Weight) {
        self.exerciseID = exerciseID
        self.exerciseName = exerciseName
        self.kind = kind
        self.value = value
        self.previous = previous
    }
}
