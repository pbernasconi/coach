import Foundation

/// Where the Lift tab's links go (lift/APP-API.md, "Links"). Ids are opened as the server sends them; a session id is
/// lower-cased, as `.liftSession` expects.
nonisolated enum LiftLinks {
    /// The screen a session id opens: the coach's session view, which hands over to the local workout for a session
    /// this iPhone has and that is not finished.
    static func session(_ sessionID: String) -> AppRoute {
        .liftSession(sessionID.lowercased())
    }

    /// The screen an exercise key opens.
    static func exercise(_ exerciseKey: String) -> AppRoute {
        .liftExercise(exerciseKey)
    }

    /// The library exercise behind an `id-<uuid>` key; nil for a `name-…` key.
    static func libraryID(fromKey key: String) -> UUID? {
        guard key.hasPrefix("id-") else { return nil }
        return UUID(uuidString: String(key.dropFirst(3)))
    }

    /// The key for a library exercise, as the server makes it.
    static func key(forLibraryID id: UUID) -> String {
        "id-\(id.uuidString.lowercased())"
    }

    /// The route a coach tip's link opens; nil for `.week` and `.section`, which the dashboard handles itself.
    static func route(for link: LiftLink) -> AppRoute? {
        switch link {
        case .session(let id): session(id)
        case .exercise(let key): exercise(key)
        case .week, .section: nil
        }
    }
}
