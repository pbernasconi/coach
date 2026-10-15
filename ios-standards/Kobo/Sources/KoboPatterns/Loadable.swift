/// The states of something loaded, which exclude each other. Use it instead of `isLoading`, `error` and
/// `data` side by side. Apps can adopt it in their screen state, or map their own type to it at the edge.
///
///     var notes: Loadable<[NoteRow]> = .loading
public nonisolated enum Loadable<Value: Equatable & Sendable>: Equatable, Sendable {
    /// No value yet; show a placeholder.
    case loading
    /// Loaded, but there is nothing to show.
    case empty
    /// Loaded with a value.
    case loaded(Value)
    /// Loading failed. `retryLabel` overrides the default retry button title.
    case failed(message: String, retryLabel: String? = nil)

    /// The phase without its payload, for animations and switches that ignore the value.
    public nonisolated enum Phase: Hashable, Sendable {
        case loading, empty, loaded, failed
    }

    public var phase: Phase {
        switch self {
        case .loading: .loading
        case .empty: .empty
        case .loaded: .loaded
        case .failed: .failed
        }
    }

    /// The loaded value, or `nil` in every other phase.
    public var value: Value? {
        if case .loaded(let value) = self { return value }
        return nil
    }

    /// Transforms the loaded value, keeping every other phase.
    public func map<Other: Equatable & Sendable>(_ transform: (Value) -> Other) -> Loadable<Other> {
        switch self {
        case .loading: .loading
        case .empty: .empty
        case .loaded(let value): .loaded(transform(value))
        case .failed(let message, let retryLabel): .failed(message: message, retryLabel: retryLabel)
        }
    }
}

extension Loadable where Value: Collection {
    /// `.loaded(value)`, or `.empty` when the collection has no elements.
    public nonisolated static func from(_ value: Value) -> Loadable<Value> {
        value.isEmpty ? .empty : .loaded(value)
    }
}
