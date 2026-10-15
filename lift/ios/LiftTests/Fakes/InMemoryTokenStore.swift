import Foundation
import Synchronization

@testable import Lift

/// A `TokenStoring` in memory, standing in for the Keychain.
nonisolated final class InMemoryTokenStore: TokenStoring {
    private let value: Mutex<String?>

    init(_ token: String? = nil) {
        value = Mutex(token)
    }

    var stored: String? { value.withLock { $0 } }

    func token() async throws -> String? { stored }

    func save(_ token: String) throws {
        value.withLock { $0 = token }
    }

    func remove() throws {
        value.withLock { $0 = nil }
    }
}
