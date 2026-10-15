import Foundation
import LiftCore
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
    public let templates: LiveTemplateRepository
    public let plans: LiveWorkoutPlanRepository

    /// A fresh store; `gym` is the plates that planned barbell loads must fit.
    public static func make(gym: GymSetup = .standard) throws -> TestStore {
        try TestStore(database: .inMemory(), ids: IDSequence(), now: ManualNow(), gym: gym)
    }

    public init(database: LiftDatabase, ids: IDSequence, now: ManualNow, gym: GymSetup = .standard) {
        self.database = database
        self.ids = ids
        self.now = now
        let makeID: @Sendable () -> UUID = { ids.next() }
        let clock: @Sendable () -> Date = { now() }
        exercises = LiveExerciseRepository(database: database, now: clock, makeID: makeID)
        sessions = LiveSessionRepository(database: database, now: clock, makeID: makeID)
        sets = LiveSetRepository(database: database, now: clock, makeID: makeID)
        outbox = LiveOutboxRepository(database: database)
        templates = LiveTemplateRepository(database: database, now: clock, makeID: makeID)
        plans = LiveWorkoutPlanRepository(database: database, now: clock, makeID: makeID, gym: { gym })
    }
}
