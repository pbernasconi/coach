import Foundation

/// A planned training day such as "Lower A". Persisted, so it carries the row stamps (DATA-2).
public struct DayTemplate: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    public var exercises: [TemplateExercise]
    public var order: Int
    public var createdAt: Date
    public var updatedAt: Date
    public var deletedAt: Date?

    public init(
        id: UUID,
        name: String,
        exercises: [TemplateExercise],
        order: Int,
        createdAt: Date,
        updatedAt: Date,
        deletedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.exercises = exercises
        self.order = order
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}
