import Foundation
import LiftStore

/// An in-memory database with every live repository wired to one `IDSequence` and one `ManualNow`.
public struct TestStore: Sendable {
    public let database: LiftDatabase
    public let ids: IDSequence
    public let now: ManualNow
    public let exercises: LiveExerciseRepository
    public let sessions: LiveSessionRepository
    public let sets: LiveSetRepository
    public let outbox: LiveOutboxRepository

    public static func make() throws -> TestStore {
        try TestStore(database: .inMemory(), ids: IDSequence(), now: ManualNow())
    }

    public init(database: LiftDatabase, ids: IDSequence, now: ManualNow) {
        self.database = database
        self.ids = ids
        self.now = now
        let makeID: @Sendable () -> UUID = { ids.next() }
        let clock: @Sendable () -> Date = { now() }
        exercises = LiveExerciseRepository(database: database, now: clock, makeID: makeID)
        sessions = LiveSessionRepository(database: database, now: clock, makeID: makeID)
        sets = LiveSetRepository(database: database, now: clock, makeID: makeID)
        outbox = LiveOutboxRepository(database: database)
    }
}
