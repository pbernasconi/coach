import Foundation
import GRDB
import LiftCore

/// One workout on one day, as stored in the `session` table.
public struct SessionRecord: Hashable, Sendable, Identifiable {
    public var id: UUID
    public var day: LocalDay
    public var title: String
    public var templateID: UUID?
    public var startedAt: Date?
    public var finishedAt: Date?
    public var warmUpNote: String?
    public var note: String?
    /// The unit the session is logged in (DATA-6). New sets are stamped with it.
    public var unitsAtLog: WeightUnit
    /// The Apple Health workout Lift saved for this session (v5); nil when none was saved.
    public var healthWorkoutID: UUID?
    /// When Lift last changed `day` on this device (v8): a move, a push to next week, or the undo of one. Other edits
    /// keep it. Nil when the day was never moved here.
    public var dayMovedAt: Date?
    /// When the running pause started (v9); nil while the workout is not paused.
    public var pausedAt: Date?
    /// Whole seconds of every pause already ended (v9). The workout's length leaves them out, and a running pause too.
    public var pausedSeconds: Int
    public var createdAt: Date
    public var updatedAt: Date
    public var deletedAt: Date?

    public init(
        id: UUID,
        day: LocalDay,
        title: String,
        templateID: UUID? = nil,
        startedAt: Date? = nil,
        finishedAt: Date? = nil,
        warmUpNote: String? = nil,
        note: String? = nil,
        unitsAtLog: WeightUnit,
        healthWorkoutID: UUID? = nil,
        dayMovedAt: Date? = nil,
        pausedAt: Date? = nil,
        pausedSeconds: Int = 0,
        createdAt: Date,
        updatedAt: Date,
        deletedAt: Date? = nil
    ) {
        self.id = id
        self.day = day
        self.title = title
        self.templateID = templateID
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.warmUpNote = warmUpNote
        self.note = note
        self.unitsAtLog = unitsAtLog
        self.healthWorkoutID = healthWorkoutID
        self.dayMovedAt = dayMovedAt
        self.pausedAt = pausedAt
        self.pausedSeconds = pausedSeconds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

extension SessionRecord: SyncedRecord {
    public static let databaseTableName = "session"
    static let entity = OutboxEntity.session

    public init(row: Row) throws {
        id = try row.required("id")
        day = try row.day("day")
        title = try row.required("title")
        templateID = try row.optional("templateID")
        startedAt = try row.optional("startedAt")
        finishedAt = try row.optional("finishedAt")
        warmUpNote = try row.optional("warmUpNote")
        note = try row.optional("note")
        unitsAtLog = try row.raw("unitsAtLog")
        healthWorkoutID = try row.optional("healthWorkoutID")  // absent from payloads written before v5
        dayMovedAt = try row.optional("dayMovedAt")  // absent from payloads written before v8
        pausedAt = try row.optional("pausedAt")  // absent from payloads written before v9
        pausedSeconds = try row.optional("pausedSeconds") ?? 0
        createdAt = try row.required("createdAt")
        updatedAt = try row.required("updatedAt")
        deletedAt = try row.optional("deletedAt")
    }

    public func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["day"] = DayText.encode(day)
        container["title"] = title
        container["templateID"] = templateID
        container["startedAt"] = startedAt
        container["finishedAt"] = finishedAt
        container["warmUpNote"] = warmUpNote
        container["note"] = note
        container["unitsAtLog"] = unitsAtLog.rawValue
        container["healthWorkoutID"] = healthWorkoutID
        container["dayMovedAt"] = dayMovedAt
        container["pausedAt"] = pausedAt
        container["pausedSeconds"] = pausedSeconds
        container["createdAt"] = createdAt
        container["updatedAt"] = updatedAt
        container["deletedAt"] = deletedAt
    }
}
