import Foundation
import LiftSync

/// A stat the server made ready to show: "Sets" "0" "hard sets this week".
nonisolated struct LiftStat: Decodable, Equatable, Sendable, Identifiable {
    var id: String
    var label: String
    var value: String
    var detail: String?
    /// A streak of 2+ weeks (the web's flame); false where the server sends none.
    var flame: Bool

    private enum Key: String, CodingKey { case id, label, value, detail, flame }

    init(id: String, label: String, value: String, detail: String? = nil, flame: Bool = false) {
        self.id = id
        self.label = label
        self.value = value
        self.detail = detail
        self.flame = flame
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Key.self)
        id = try container.decode(String.self, forKey: .id)
        label = try container.decode(String.self, forKey: .label)
        value = try container.decode(String.self, forKey: .value)
        detail = try container.decodeIfPresent(String.self, forKey: .detail)
        flame = try container.decodeIfPresent(Bool.self, forKey: .flame) ?? false
    }
}

/// Where a coach tip leads: a session, an exercise, the Week tab or a section of the Lift screen.
nonisolated enum LiftLink: Decodable, Equatable, Sendable {
    case session(String)
    case exercise(String)
    case week
    case section(String)

    private enum Key: String, CodingKey { case kind, sessionId, exerciseKey, section }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Key.self)
        switch try container.decode(String.self, forKey: .kind) {
        case "session": self = .session(try container.decode(String.self, forKey: .sessionId))
        case "exercise": self = .exercise(try container.decode(String.self, forKey: .exerciseKey))
        case "week": self = .week
        case "section": self = .section(try container.decode(String.self, forKey: .section))
        case let kind:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: "kind \(kind)")
        }
    }
}
