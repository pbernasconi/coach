extension Loadable.Phase {
    /// Pull to refresh runs only over loaded content: a placeholder, an empty state or a failure has its own action.
    public nonisolated var acceptsRefresh: Bool { self == .loaded }

    /// The phase is a settled answer (anything but `.loading`), so a section stops speaking "Loading".
    public nonisolated var isSettled: Bool { self != .loading }
}
