import Foundation

/// A template read from a link and checked against the limits: what will be added, before names are resolved.
public struct LinkedTemplate: Hashable, Sendable {
    public var name: String
    /// The unit of every weight in the template; nil when it holds no weight.
    public var unit: WeightUnit?
    public var exercises: [LinkedExercise]

    public init(name: String, unit: WeightUnit?, exercises: [LinkedExercise]) {
        self.name = name
        self.unit = unit
        self.exercises = exercises
    }
}

/// One exercise slot of a `LinkedTemplate`, with the template defaults filled in.
public struct LinkedExercise: Hashable, Sendable {
    public var name: String
    public var sets: Int
    public var repRange: ClosedRange<Int>
    public var weight: Weight?
    public var restSeconds: Int
    public var note: String?
    /// How the weight counts if the exercise is new to the library; nil leaves it to the name.
    public var load: LinkedLoad?

    public init(
        name: String,
        sets: Int = TemplateExercise.defaultSets,
        repRange: ClosedRange<Int> = TemplateExercise.defaultRepRange,
        weight: Weight? = nil,
        restSeconds: Int = TemplateExercise.defaultRestSeconds,
        note: String? = nil,
        load: LinkedLoad? = nil
    ) {
        self.name = name
        self.sets = sets
        self.repRange = repRange
        self.weight = weight
        self.restSeconds = restSeconds
        self.note = note
        self.load = load
    }
}

/// The `load` key: how a new exercise's weight counts.
public enum LinkedLoad: String, Hashable, Sendable, CaseIterable {
    case total
    case hand
    case side
    case bodyweight = "bw"

    /// The library load mode.
    public var loadMode: LoadMode {
        switch self {
        case .total: .total
        case .hand: .perHand
        case .side: .perSide
        case .bodyweight: .bodyweight(added: nil)
        }
    }
}
