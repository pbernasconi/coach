import Foundation
import GRDB
import LiftCore

/// Converts row payloads between the database and the wire (SYNC.md). On the wire, keys are column names,
/// UUIDs are strings and dates are ISO 8601 with milliseconds and `Z`. The outbox stores dates the way GRDB
/// writes them ("yyyy-MM-dd HH:mm:ss.SSS", UTC), so a push converts the date columns first.
public enum SyncPayload {
    /// Columns that hold dates in every synced table.
    static let dateColumns: Set = [
        "createdAt", "updatedAt", "deletedAt", "startedAt", "finishedAt", "completedAt", "dayMovedAt",
        "pausedAt", "occurredAt",
    ]

    /// Columns that hold UUIDs (blobs locally, strings on the wire).
    static let uuidColumns: Set = [
        "id", "sessionID", "exerciseID", "sessionExerciseID", "templateID", "healthWorkoutID", "setID",
    ]

    private static let isoWithMilliseconds = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
    private static let isoWholeSeconds = Date.ISO8601FormatStyle()

    /// The wire object for an outbox entry's stored payload.
    public static func wireObject(outboxPayload: String) throws -> [String: JSONValue] {
        let decoded = try JSONDecoder().decode(JSONValue.self, from: Data(outboxPayload.utf8))
        guard case .object(var object) = decoded else {
            throw AppError(.decoding, detail: "outbox payload is not an object")
        }
        for (key, value) in object where dateColumns.contains(key) {
            guard let text = value.stringValue else { continue }
            object[key] = .string(try wireDate(fromStored: text))
        }
        return object
    }

    /// An ISO 8601 date string ("2026-10-15T07:30:00.000Z"), rounded to the millisecond.
    public static func wireDate(_ date: Date) -> String {
        StampText(date: date).wire
    }

    /// Parses a wire date, with or without milliseconds. The GRDB form is accepted too.
    public static func date(fromWire text: String) -> Date? {
        if let date = try? isoWithMilliseconds.parse(text) { return date }
        if let date = try? isoWholeSeconds.parse(text) { return date }
        return Date.fromDatabaseValue(text.databaseValue)
    }

    /// The wire form of a stored stamp, converted as text so no millisecond is lost.
    static func wireDate(fromStored text: String) throws -> String {
        if let stamp = StampText(stored: text) ?? StampText(wire: text) { return stamp.wire }
        guard let date = Date.fromDatabaseValue(text.databaseValue) ?? self.date(fromWire: text) else {
            throw AppError(.decoding, detail: "date column")
        }
        return wireDate(date)
    }

    /// The stored (GRDB) form of a wire stamp, converted as text so no millisecond is lost. Offsets other
    /// than `Z` go through `Date`, rounded to the millisecond.
    static func storedDate(fromWire text: String) -> String? {
        if let stamp = StampText(wire: text) ?? StampText(stored: text) { return stamp.stored }
        return date(fromWire: text).map { StampText(date: $0).stored }
    }

    /// A database row for a pulled payload: the inverse of `wireObject`.
    static func row(from object: [String: JSONValue]) throws -> Row {
        var values: [String: (any DatabaseValueConvertible)?] = [:]
        for (key, value) in object {
            values[key] = try databaseValue(value, column: key)
        }
        return Row(values)
    }

    private static func databaseValue(_ value: JSONValue, column: String) throws -> DatabaseValue {
        switch value {
        case .null: return .null
        case .bool(let flag): return flag.databaseValue
        case .integer(let number): return number.databaseValue
        case .double(let number): return number.databaseValue
        case .array, .object: return try JSONText.encode(value).databaseValue
        case .string(let text):
            if uuidColumns.contains(column) {
                guard let id = UUID(uuidString: text) else { throw AppError(.decoding, detail: column) }
                return id.databaseValue
            }
            if dateColumns.contains(column) {
                guard let stored = storedDate(fromWire: text) else { throw AppError(.decoding, detail: column) }
                return stored.databaseValue
            }
            return text.databaseValue
        }
    }
}
