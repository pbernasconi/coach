import LiftSync

/// Where the sync token is kept: the Keychain in the app, memory in tests. The transport reads it as a
/// `TokenProvider`; Settings writes it through `Syncing.setToken(_:)`.
nonisolated protocol TokenStoring: TokenProvider {
    /// Stores `token`, replacing any previous one.
    func save(_ token: String) throws

    /// Deletes the stored token, if any.
    func remove() throws
}
