import Foundation

/// What was actually lifted (DATA-7).
public struct SetActual: Codable, Hashable, Sendable {
    public var reps: Int?
    public var weight: Weight?
    public var completedAt: Date?

    public init(reps: Int? = nil, weight: Weight? = nil, completedAt: Date? = nil) {
        self.reps = reps
        self.weight = weight
        self.completedAt = completedAt
    }
}
