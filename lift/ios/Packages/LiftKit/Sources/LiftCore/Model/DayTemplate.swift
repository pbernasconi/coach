import Foundation

/// A planned training day such as "Lower A": a name and its exercise slots in order. Persisted, so it carries the
/// row stamps (DATA-2).
public struct DayTemplate: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    public var exercises: [TemplateExercise]
    /// Where the template sits in the Templates list.
    public var position: Int
    public var createdAt: Date
    public var updatedAt: Date
    public var deletedAt: Date?

    public init(
        id: UUID,
        name: String,
        exercises: [TemplateExercise],
        position: Int,
        createdAt: Date,
        updatedAt: Date,
        deletedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.exercises = exercises
        self.position = position
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }

    /// Every planned set across the slots.
    public var totalSets: Int { exercises.reduce(0) { $0 + $1.sets } }
}
