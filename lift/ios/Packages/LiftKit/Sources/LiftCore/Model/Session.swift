import Foundation

/// One workout on one day. Persisted, so it carries the row stamps (DATA-2).
public struct Session: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var date: LocalDay
    public var title: String
    public var templateID: UUID?
    public var exercises: [SessionExercise]
    public var startedAt: Date?
    public var finishedAt: Date?
    /// Whole seconds the workout was paused, left out of its length.
    public var pausedSeconds: Int
    public var warmUpNote: String?
    public var note: String?
    /// The unit the user logged in (DATA-6).
    public var unitsAtLog: WeightUnit
    public var createdAt: Date
    public var updatedAt: Date
    public var deletedAt: Date?

    public init(
        id: UUID,
        date: LocalDay,
        title: String,
        templateID: UUID? = nil,
        exercises: [SessionExercise] = [],
        startedAt: Date? = nil,
        finishedAt: Date? = nil,
        warmUpNote: String? = nil,
        note: String? = nil,
        unitsAtLog: WeightUnit,
        createdAt: Date,
        updatedAt: Date,
        deletedAt: Date? = nil,
        pausedSeconds: Int = 0
    ) {
        self.id = id
        self.date = date
        self.title = title
        self.templateID = templateID
        self.exercises = exercises
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.warmUpNote = warmUpNote
        self.note = note
        self.unitsAtLog = unitsAtLog
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
        self.pausedSeconds = pausedSeconds
    }

    /// Every set in the session, in order.
    public var allSets: [LoggedSet] { exercises.flatMap(\.sets) }

    /// True when the session was finished or has at least one done set.
    public var isCompleted: Bool { finishedAt != nil || allSets.contains(where: \.isDone) }
}
