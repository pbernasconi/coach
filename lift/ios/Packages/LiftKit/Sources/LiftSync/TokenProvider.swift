import Foundation

/// Supplies the sync bearer token (SYNC.md, NET-5). Nil means none is stored yet, so sync is not set up.
public protocol TokenProvider: Sendable {
    func token() async throws -> String?
}

/// A fixed token, for tests and previews. The app uses `KeychainTokenStore`.
public struct StaticTokenProvider: TokenProvider {
    private let value: String?

    public init(_ value: String?) {
        self.value = value
    }

    public func token() async throws -> String? { value }
}
