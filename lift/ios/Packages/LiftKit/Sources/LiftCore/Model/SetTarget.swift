import Foundation

/// What a set was meant to be (DATA-7). Every field is optional because notes are often terse.
public struct SetTarget: Codable, Hashable, Sendable {
    public var reps: Int?
    public var repRange: ClosedRange<Int>?
    public var weight: Weight?

    public init(reps: Int? = nil, repRange: ClosedRange<Int>? = nil, weight: Weight? = nil) {
        self.reps = reps
        self.repRange = repRange
        self.weight = weight
    }

    /// A target with nothing in it.
    public static let none = SetTarget()
}
