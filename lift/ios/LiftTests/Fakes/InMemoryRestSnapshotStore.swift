import Foundation
import Synchronization

@testable import Lift

/// A `RestSnapshotStoring` in memory, standing in for the App Group's defaults.
nonisolated final class InMemoryRestSnapshotStore: RestSnapshotStoring {
    private let rest: Mutex<RestSnapshot?>

    init(_ rest: RestSnapshot? = nil) {
        self.rest = Mutex(rest)
    }

    func load() -> RestSnapshot? {
        rest.withLock { $0 }
    }

    func save(_ rest: RestSnapshot?) {
        self.rest.withLock { $0 = rest }
    }
}
