import Foundation
import LiftCore

/// One top-level section of an App API response: `{ "ok": true, …data }` or `{ "ok": false }` (APP-API.md, shared
/// rules). A section that is missing, says `ok: false`, or does not decode is `.failed`, so one bad loader never
/// blanks a screen.
public enum AppSection<Value: Decodable & Equatable & Sendable>: Decodable, Equatable, Sendable {
    case ok(Value)
    case failed

    private enum Keys: String, CodingKey { case ok }

    public init(from decoder: any Decoder) throws {
        guard (try? decoder.container(keyedBy: Keys.self).decode(Bool.self, forKey: .ok)) == true,
            let value = try? Value(from: decoder)
        else {
            self = .failed
            return
        }
        self = .ok(value)
    }

    /// The section's data, or nil when it failed.
    public var value: Value? {
        guard case .ok(let value) = self else { return nil }
        return value
    }
}

extension KeyedDecodingContainer {
    /// A section that is `.failed` when its key is missing, instead of failing the whole response.
    public func section<Value>(_ key: Key) -> AppSection<Value> {
        (try? decodeIfPresent(AppSection<Value>.self, forKey: key)) ?? .failed
    }
}

/// A plain `YYYY-MM-DD` calendar day, as every App API day is sent. Never a `Date`.
public struct PlainDay: Decodable, Hashable, Comparable, Sendable {
    public var day: LocalDay

    public init(_ day: LocalDay) {
        self.day = day
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        let text = try container.decode(String.self)
        guard let day = CoachPlanDates.day(fromPlain: text) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "not a YYYY-MM-DD day")
        }
        self.day = day
    }

    public static func < (lhs: PlainDay, rhs: PlainDay) -> Bool { lhs.day < rhs.day }
}

/// A tone the server picks for a dot, a pill or a change (the web's colours). The phone always shows the text next to
/// it. Unknown values read as `neutral`.
public enum AppTone: String, Decodable, Equatable, Sendable, CaseIterable {
    case good, warn, bad, neutral, up, down

    public init(from decoder: any Decoder) throws {
        let text = try decoder.singleValueContainer().decode(String.self)
        self = AppTone(rawValue: text) ?? .neutral
    }
}
