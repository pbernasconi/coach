import Foundation

/// One exercise slot in a day template: a library exercise and how its sets are planned.
public struct TemplateExercise: Codable, Hashable, Sendable, Identifiable {
    /// The defaults for a newly added slot: 3 × 8–12, 2 minutes' rest.
    public static let defaultSets = 3
    public static let defaultRepRange = 8...12
    public static let defaultRestSeconds = 120

    public var id: UUID
    /// The library exercise (`Exercise.id`).
    public var exerciseID: UUID
    /// The exercise's name when the slot was added, shown if the library row is missing.
    public var displayName: String
    public var sets: Int
    /// The rep target; a single number when both ends are equal ("5"), otherwise a range ("8–12").
    public var repRange: ClosedRange<Int>
    /// The planned load; nil leaves it to the last session (or to the person, the first time).
    public var weight: Weight?
    public var restSeconds: Int?
    public var kind: SetKind
    /// A cue for the exercise ("Deep squat"); a session planned from the template starts with it as its note.
    public var note: String?

    public init(
        id: UUID,
        exerciseID: UUID,
        displayName: String,
        sets: Int = TemplateExercise.defaultSets,
        repRange: ClosedRange<Int> = TemplateExercise.defaultRepRange,
        weight: Weight? = nil,
        restSeconds: Int? = TemplateExercise.defaultRestSeconds,
        kind: SetKind = .working,
        note: String? = nil
    ) {
        self.id = id
        self.exerciseID = exerciseID
        self.displayName = displayName
        self.sets = sets
        self.repRange = repRange
        self.weight = weight
        self.restSeconds = restSeconds
        self.kind = kind
        self.note = note
    }

    /// The set target before any history: the rep target and the planned load.
    public var target: SetTarget {
        repRange.lowerBound == repRange.upperBound
            ? SetTarget(reps: repRange.lowerBound, weight: weight)
            : SetTarget(repRange: repRange, weight: weight)
    }
}
