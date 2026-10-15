import Foundation

/// A library exercise matched to a written name, and how strongly.
public struct ExerciseMatch: Hashable, Sendable {
    public enum Kind: String, Hashable, Sendable {
        /// The normalized name equals the exercise's normalized name.
        case name
        /// The normalized name equals one of the exercise's normalized aliases.
        case alias
        /// Same words in a different order ("row single arm db").
        case reorderedTokens
    }

    public let exercise: Exercise
    public let kind: Kind

    public init(exercise: Exercise, kind: Kind) {
        self.exercise = exercise
        self.kind = kind
    }
}
