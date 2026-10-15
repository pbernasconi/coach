import Core

/// Everything the Example screen renders. Exclusive states are enums (SCR-6).
struct ExampleState: Equatable, Sendable {
    var items: Loadable<[ExampleItem]> = .loading
    var draftName: String = ""
    var save: SaveStatus = .idle
    var destination: Destination?

    enum SaveStatus: Equatable, Sendable { case idle, saving, failed(AppError.Kind) }
    enum Destination: Equatable, Sendable { case detail(ExampleItem.ID) }
}
