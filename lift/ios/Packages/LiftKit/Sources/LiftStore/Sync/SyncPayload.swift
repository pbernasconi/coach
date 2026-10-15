import Foundation
import GRDB
import LiftCore

/// Converts row payloads between the database and the wire (SYNC.md). On the wire, keys are column names,
/// UUIDs are strings and dates are ISO 8601 with milliseconds and `Z`. The outbox stores dates the way GRDB
/// writes them ("yyyy-MM-dd HH:mm:ss.SSS", UTC), so a push converts the date columns first.
public enum SyncPayload {
    /// Columns that hold dates in every synced table.
    static let dateColumns: Set = ["createdAt", "updatedAt", "deletedAt", "startedAt", "finishedAt", "completedAt"]

    /// Columns that hold UUIDs (blobs locally, strings on the wire).
    static let uuidColumns: Set = ["id", "sessionID", "exerciseID", "sessionExerciseID", "templateID"]

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

    /// An ISO 8601 date string ("2026-10-15T07:30:00.000Z").
    public static func wireDate(_ date: Date) -> String {
        date.formatted(isoWithMilliseconds)
    }

    /// Parses a wire date, with or without milliseconds. The GRDB form is accepted too.
    public static func date(fromWire text: String) -> Date? {
        if let date = try? isoWithMilliseconds.parse(text) { return date }
        if let date = try? isoWholeSeconds.parse(text) { return date }
        return Date.fromDatabaseValue(text.databaseValue)
    }

    private static func wireDate(fromStored text: String) throws -> String {
        guard let date = Date.fromDatabaseValue(text.databaseValue) ?? self.date(fromWire: text) else {
            throw AppError(.decoding, detail: "date column")
        }
        return wireDate(date)
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
                guard let date = date(fromWire: text) else { throw AppError(.decoding, detail: column) }
                return date.databaseValue
            }
            return text.databaseValue
        }
    }
}
