import Foundation

@testable import Lift

/// A `SyncTokenApplying` that records the tokens the router passed on.
final class RecordingSyncTokenLink: SyncTokenApplying {
    private(set) var tokens: [String] = []

    @discardableResult
    func apply(token: String) -> Task<Void, Never> {
        tokens.append(token)
        return Task {}
    }
}
