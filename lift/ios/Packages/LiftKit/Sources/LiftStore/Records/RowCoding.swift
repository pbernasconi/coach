import Foundation
import GRDB
import LiftCore

/// Column decoding that throws `AppError(.decoding)` instead of trapping on a bad value.
extension Row {
    func required<Value: DatabaseValueConvertible>(_ column: String) throws -> Value {
        try decode(Value.self, forColumn: column)
    }

    func optional<Value: DatabaseValueConvertible>(_ column: String) throws -> Value? {
        try decode(Value?.self, forColumn: column)
    }

    func raw<Value: RawRepresentable<String>>(_ column: String) throws -> Value {
        let text: String = try required(column)
        guard let value = Value(rawValue: text) else { throw AppError(.decoding, detail: column) }
        return value
    }

    func optionalRaw<Value: RawRepresentable<String>>(_ column: String) throws -> Value? {
        guard let text: String = try optional(column) else { return nil }
        guard let value = Value(rawValue: text) else { throw AppError(.decoding, detail: column) }
        return value
    }

    func day(_ column: String) throws -> LocalDay {
        guard let day = DayText.decode(try required(column)) else { throw AppError(.decoding, detail: column) }
        return day
    }

    /// A weight stored as a value column plus a unit column; nil when the value is NULL.
    func weight(_ valueColumn: String, unitColumn: String) throws -> Weight? {
        guard let value: Double = try optional(valueColumn) else { return nil }
        let unit: WeightUnit = try raw(unitColumn)
        return Weight(value, unit)
    }

    /// The three load mode columns written by `PersistenceContainer.setLoadMode`.
    func loadMode() throws -> LoadMode {
        let kind: String = try required("loadMode")
        switch kind {
        case "total": return .total
        case "perHand": return .perHand
        case "perSide": return .perSide
        case "bodyweight": return .bodyweight(added: try weight("loadAddedValue", unitColumn: "loadAddedUnit"))
        default: throw AppError(.decoding, detail: "loadMode")
        }
    }

    /// A JSON array column, such as aliases or muscles.
    func jsonArray<Element: Decodable>(_ column: String) throws -> [Element] {
        let text: String = try required(column)
        return try JSONDecoder().decode([Element].self, from: Data(text.utf8))
    }
}

extension PersistenceContainer {
    mutating func setLoadMode(_ mode: LoadMode) {
        var added: Weight?
        switch mode {
        case .total: self["loadMode"] = "total"
        case .perHand: self["loadMode"] = "perHand"
        case .perSide: self["loadMode"] = "perSide"
        case .bodyweight(let weight):
            self["loadMode"] = "bodyweight"
            added = weight
        }
        self["loadAddedValue"] = added?.value
        self["loadAddedUnit"] = added?.unit.rawValue
    }

    mutating func setJSONArray(_ values: [some Encodable], forKey column: String) throws {
        self[column] = try JSONText.encode(values)
    }
}

/// Stable JSON text (sorted keys, unescaped slashes) for JSON columns and outbox payloads.
enum JSONText {
    static func encode(_ value: some Encodable) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        guard let text = String(bytes: try encoder.encode(value), encoding: .utf8) else {
            throw AppError(.invalidInput, detail: "JSON is not UTF-8")
        }
        return text
    }
}

/// `LocalDay` as sortable "YYYY-MM-DD" text, so `day BETWEEN ? AND ?` works on the index.
enum DayText {
    static func encode(_ day: LocalDay) -> String {
        "\(pad(day.year, 4))-\(pad(day.month, 2))-\(pad(day.day, 2))"
    }

    static func decode(_ text: String) -> LocalDay? {
        let parts = text.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return LocalDay(year: parts[0], month: parts[1], day: parts[2])
    }

    private static func pad(_ number: Int, _ width: Int) -> String {
        let digits = String(number)
        return String(repeating: "0", count: max(0, width - digits.count)) + digits
    }
}
