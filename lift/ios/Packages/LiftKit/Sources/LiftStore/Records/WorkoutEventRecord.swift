import Foundation
import GRDB

/// What happened at one moment of a workout (v10). Raw values are the wire values (SYNC.md); keep them stable.
public enum WorkoutEventKind: String, Codable, Hashable, Sendable, CaseIterable {
    case workoutStarted
    case workoutPaused
    case workoutResumed
    case workoutFinished
    case workoutDiscarded
    /// Start on the first set of an exercise, in the dock.
    case exerciseStarted
    case setLogged
    /// A logged or skipped set back to planned.
    case setUndone
    case setSkipped
    case setRemoved
    /// `seconds`: the rest's planned length.
    case restStarted
    /// `seconds`: the time added.
    case restExtended
    /// Ended before its end, by Skip, a pause or Finish. `seconds`: the time rested.
    case restSkipped
    /// Ran its whole length; `occurredAt` is its end. `seconds`: the time rested.
    case restEnded
}

/// Where the moment was recorded.
public enum WorkoutEventSource: String, Codable, Hashable, Sendable, CaseIterable {
    /// The Workout screen.
    case app
    /// The workout Live Activity's buttons (Lock Screen, Dynamic Island).
    case lockScreen
}

/// One moment of a workout, as the app reports it to `WorkoutEventRepository`.
public struct WorkoutEvent: Hashable, Sendable {
    public var sessionID: UUID
    public var kind: WorkoutEventKind
    public var occurredAt: Date
    /// The set it is about: the set logged, or the set a rest follows; nil for the workout as a whole.
    public var setID: UUID?
    /// A length in whole seconds, as `kind` says; nil when it has none.
    public var seconds: Int?
    public var source: WorkoutEventSource

    public init(
        sessionID: UUID,
        kind: WorkoutEventKind,
        occurredAt: Date,
        setID: UUID? = nil,
        seconds: Int? = nil,
        source: WorkoutEventSource = .app
    ) {
        self.sessionID = sessionID
        self.kind = kind
        self.occurredAt = occurredAt
        self.setID = setID
        self.seconds = seconds
        self.source = source
    }
}

/// A `WorkoutEvent` as stored in the `workoutEvent` table. `kind` and `source` stay text, so a row from a newer build
/// with a kind this one does not know still pulls and keeps.
public struct WorkoutEventRecord: Hashable, Sendable, Identifiable {
    public var id: UUID
    public var sessionID: UUID
    public var kind: String
    public var occurredAt: Date
    public var setID: UUID?
    public var seconds: Int?
    public var source: String
    public var createdAt: Date
    public var updatedAt: Date
    public var deletedAt: Date?

    init(id: UUID, event: WorkoutEvent, createdAt: Date) {
        self.id = id
        sessionID = event.sessionID
        kind = event.kind.rawValue
        occurredAt = event.occurredAt
        setID = event.setID
        seconds = event.seconds
        source = event.source.rawValue
        self.createdAt = createdAt
        updatedAt = createdAt
        deletedAt = nil
    }
}

extension WorkoutEventRecord: SyncedRecord {
    public static let databaseTableName = "workoutEvent"
    static let entity = OutboxEntity.workoutEvent

    public init(row: Row) throws {
        id = try row.required("id")
        sessionID = try row.required("sessionID")
        kind = try row.required("kind")
        occurredAt = try row.required("occurredAt")
        setID = try row.optional("setID")
        seconds = try row.optional("seconds")
        source = try row.required("source")
        createdAt = try row.required("createdAt")
        updatedAt = try row.required("updatedAt")
        deletedAt = try row.optional("deletedAt")
    }

    public func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["sessionID"] = sessionID
        container["kind"] = kind
        container["occurredAt"] = occurredAt
        container["setID"] = setID
        container["seconds"] = seconds
        container["source"] = source
        container["createdAt"] = createdAt
        container["updatedAt"] = updatedAt
        container["deletedAt"] = deletedAt
    }
}
