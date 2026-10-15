import Core

/// Features depend on this protocol only (DI-5). Reads are streams from the local DB (DATA-1).
public protocol ExampleRepository: Sendable {
    func observeAll() -> AsyncStream<[ExampleItem]>
    func create(name: String) async throws
    func delete(id: ExampleItem.ID) async throws
}
