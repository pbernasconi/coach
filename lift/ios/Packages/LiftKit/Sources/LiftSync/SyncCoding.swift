import Foundation
import LiftStore

/// JSON coders for the sync wire. Any `Date` is ISO 8601 with milliseconds and `Z` (SYNC.md); keys are
/// sorted so a body is stable for tests and logs.
enum SyncCoding {
    static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(SyncPayload.wireDate(date))
        }
        return encoder
    }

    static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let text = try container.decode(String.self)
            guard let date = SyncPayload.date(fromWire: text) else {
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "not an ISO 8601 date")
            }
            return date
        }
        return decoder
    }
}
