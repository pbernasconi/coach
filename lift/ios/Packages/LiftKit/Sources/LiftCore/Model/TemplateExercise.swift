import Foundation

/// One exercise slot in a day template.
public struct TemplateExercise: Codable, Hashable, Sendable {
    public var exerciseID: UUID
    public var sets: Int
    public var repRange: ClosedRange<Int>
    public var restSeconds: Int?

    public init(exerciseID: UUID, sets: Int, repRange: ClosedRange<Int>, restSeconds: Int? = nil) {
        self.exerciseID = exerciseID
        self.sets = sets
        self.repRange = repRange
        self.restSeconds = restSeconds
    }
}
