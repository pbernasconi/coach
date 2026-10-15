import Foundation
import GRDB

/// Turns a record's database columns into the outbox JSON: one key per column, UUID blobs as strings,
/// dates as GRDB writes them ("yyyy-MM-dd HH:mm:ss.SSS", UTC).
enum OutboxPayload {
    static func json(for record: some EncodableRecord) throws -> String {
        try JSONText.encode(record.databaseDictionary.mapValues(JSONScalar.init))
    }
}

/// One SQLite value as JSON.
private enum JSONScalar: Encodable {
    case null
    case integer(Int64)
    case double(Double)
    case string(String)

    init(_ value: DatabaseValue) {
        switch value.storage {
        case .null: self = .null
        case .int64(let number): self = .integer(number)
        case .double(let number): self = .double(number)
        case .string(let text): self = .string(text)
        case .blob(let data):
            if data.count == 16, let uuid = UUID.fromDatabaseValue(value) {
                self = .string(uuid.uuidString)
            } else {
                self = .string(data.base64EncodedString())
            }
        }
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .integer(let number): try container.encode(number)
        case .double(let number): try container.encode(number)
        case .string(let text): try container.encode(text)
        }
    }
}
