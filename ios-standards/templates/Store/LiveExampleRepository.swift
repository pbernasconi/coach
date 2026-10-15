import Core
import GRDB

/// Live implementation: GRDB ValueObservation for reads; one transaction per write that also
/// appends to the outbox (DATA-1, DATA-3). Ids and timestamps are injected (CONC-5, DATA-2).
public struct LiveExampleRepository: ExampleRepository {
    private let db: any DatabaseWriter
    private let newID: @Sendable () -> UUID
    private let now: @Sendable () -> Date

    public init(db: any DatabaseWriter, newID: @escaping @Sendable () -> UUID, now: @escaping @Sendable () -> Date) {
        self.db = db
        self.newID = newID
        self.now = now
    }

    public func observeAll() -> AsyncStream<[ExampleItem]> {
        let (stream, continuation) = AsyncStream.makeStream(
            of: [ExampleItem].self,
            bufferingPolicy: .bufferingNewest(1)
        )
        let observation = ValueObservation.tracking { db in
            try ExampleItem.filter(Column("deletedAt") == nil).order(Column("createdAt")).fetchAll(db)
        }
        let task = Task {
            do {
                for try await items in observation.values(in: db) { continuation.yield(items) }
            } catch {
                Log.store.error("observeAll failed: \(String(describing: type(of: error)), privacy: .public)")
            }
            continuation.finish()
        }
        continuation.onTermination = { _ in task.cancel() }
        return stream
    }

    public func create(name: String) async throws {
        let item = ExampleItem(id: newID(), name: name, createdAt: now(), updatedAt: now(), deletedAt: nil)
        try await db.write { db in
            try item.insert(db)
            try OutboxEntry(id: newID(), table: "example", rowID: item.id, op: .upsert, createdAt: now()).insert(db)
        }
    }

    public func delete(id: ExampleItem.ID) async throws {
        try await db.write { db in
            guard var item = try ExampleItem.fetchOne(db, key: id) else { return }
            item.deletedAt = now()  // tombstone, never hard-delete before sync (DATA-2)
            item.updatedAt = now()
            try item.update(db)
            try OutboxEntry(id: newID(), table: "example", rowID: id, op: .upsert, createdAt: now()).insert(db)
        }
    }
}
