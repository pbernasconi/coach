import Foundation
import LiftSync

/// `GET /api/app/settings` (lift/APP-API.md, "Settings"): the server's half of Settings. Every connection's state and
/// the coach's targets and next event; each section fails alone.
nonisolated struct AppSettings: Decodable, Equatable, Sendable {
    static let path = "api/app/settings"

    var connections: AppSection<Connections>
    var coach: AppSection<Coach>

    private enum Keys: String, CodingKey { case connections, coach }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        connections = container.section(.connections)
        coach = container.section(.coach)
    }

    init(connections: AppSection<Connections>, coach: AppSection<Coach>) {
        self.connections = connections
        self.coach = coach
    }

    /// Every service Coach reads from, with one line each, and how many need attention.
    nonisolated struct Connections: Decodable, Equatable, Sendable {
        var summary: Summary
        var items: [Connection]
    }

    nonisolated struct Summary: Decodable, Equatable, Sendable {
        var attention: Int
        var total: Int
        /// `ok | info | warn | error`.
        var level: String
        /// "1 of 5 needs attention".
        var text: String
    }

    nonisolated struct Connection: Decodable, Equatable, Sendable, Identifiable {
        /// `strava | garmin | calendar | lift | bodyspec | function | scale`.
        var id: String
        var name: String
        /// `connected | attention | error | off`.
        var state: String
        /// `ok | info | warn | error`: the dot's colour.
        var level: String
        /// "Synced 2 h ago".
        var statusText: String
        var detailText: String?
        /// What is wrong, or what to do; nil when all is well.
        var note: String?
    }

    /// The coach's side: the weekly targets and the next event.
    nonisolated struct Coach: Decodable, Equatable, Sendable {
        /// "35 km run · 4 h ride · 2 strength a week".
        var targetsText: String?
        var nextEvent: Event?
    }

    nonisolated struct Event: Decodable, Equatable, Sendable {
        var name: String
        /// "Dec 6".
        var dateText: String?
        /// "In 6 wk 3 d".
        var countdownText: String
        /// `A | B | C`.
        var priority: String
    }
}
