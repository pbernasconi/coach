import Foundation
import LiftCore
import LiftStore
import LiftSync
import LiftTesting

/// A local in-memory store wired to a `SyncEngine` with a fake transport and a test clock.
struct SyncHarness {
    let store: TestStore
    let syncState: LiveSyncStateRepository
    let transport: FakeSyncTransport
    let clock: TestClock
    let engine: SyncEngine

    init(store: TestStore? = nil, transport: FakeSyncTransport = FakeSyncTransport()) throws {
        let store = try store ?? TestStore.make()
        self.store = store
        self.transport = transport
        syncState = LiveSyncStateRepository(database: store.database) { store.ids.next() }
        clock = TestClock()
        engine = Self.engine(store: store, state: syncState, transport: transport, clock: clock)
    }

    /// A second engine over the same database, as after a relaunch.
    func relaunchedEngine() -> SyncEngine {
        Self.engine(store: store, state: syncState, transport: transport, clock: clock)
    }

    func pendingCount() async throws -> Int {
        try await store.outbox.pending(limit: 10_000).count
    }

    private static func engine(
        store: TestStore,
        state: LiveSyncStateRepository,
        transport: FakeSyncTransport,
        clock: TestClock
    ) -> SyncEngine {
        let now = store.now
        return SyncEngine(
            outbox: store.outbox,
            state: state,
            transport: transport,
            now: { now() },
            clock: clock,
            debounce: .seconds(3)
        )
    }
}

/// Another device writing to the server: its outbox becomes the changes a pull returns.
struct RemoteDevice {
    let store: TestStore

    init() throws {
        store = try TestStore(database: .inMemory(), ids: IDSequence(prefix: 0xAA), now: ManualNow())
    }

    /// Everything written since the last call, as pulled changes in write order.
    func takeChanges() async throws -> [RemoteChange] {
        let entries = try await store.outbox.pending(limit: 10_000)
        try await store.outbox.acknowledge(entries.map(\.id))
        return try entries.map { entry in
            RemoteChange(
                entity: entry.entity,
                rowID: entry.rowID,
                payload: try SyncPayload.wireObject(outboxPayload: entry.payload)
            )
        }
    }

    /// One exercise, one session with that exercise, and one planned set: all four entities.
    func writeWorkout() async throws -> (exercise: Exercise, slot: SessionExerciseRecord, set: SetRecord) {
        let exercise = try await store.exercises.create(
            name: "Made-up press",
            equipment: .dumbbell,
            loadMode: .perHand,
            primary: [.chest],
            secondary: []
        )
        let session = try await store.sessions.createSession(
            on: Fixtures.monday,
            title: "Upper A",
            unit: .kg,
            templateID: nil
        )
        let slot = try await store.sessions.addExercise(ExerciseSlot(exercise: exercise), to: session.id)
        let set = try await store.sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
        return (exercise, slot, set)
    }
}

extension TestStore {
    /// A kg session with one squat set: three outbox entries.
    func writeLocalSet() async throws -> SetRecord {
        let session = try await sessions.createSession(
            on: Fixtures.monday,
            title: "Lower A",
            unit: .kg,
            templateID: nil
        )
        let slot = try await sessions.addExercise(ExerciseSlot(exercise: Fixtures.squat), to: session.id)
        return try await sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
    }
}
