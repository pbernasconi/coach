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

/// Reads the token for a request. A token that cannot be read (the Keychain refuses, for example an unsigned
/// simulator build) counts as no token: the screens then say "not connected", never "could not be reached".
enum TokenRead {
    static func token(from tokens: any TokenProvider) async throws -> String? {
        let token: String?
        do {
            token = try await tokens.token()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            return nil
        }
        guard let token, !token.isEmpty else { return nil }
        return token
    }
}
