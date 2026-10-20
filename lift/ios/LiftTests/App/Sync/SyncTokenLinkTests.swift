import Foundation
import LiftSync
import Testing

@testable import Lift

/// A `lift://sync?token=…` link stores the token and syncs at once; a build that cannot sync ignores it.
@MainActor
@Suite struct SyncTokenLinkTests {
    let sync = FakeSyncing()

    @Test func aLinkStoresTheTokenThenSyncs() async {
        await SyncTokenLink(sync: sync).apply(token: "abc123").value

        #expect(sync.savedTokens == ["abc123"])
        #expect(sync.syncNowCount == 1)
    }

    @Test func aBuildWithoutAServerIgnoresTheLink() async {
        sync.isConfigured = false

        await SyncTokenLink(sync: sync).apply(token: "abc123").value

        #expect(sync.savedTokens.isEmpty)
        #expect(sync.syncNowCount == 0)
    }

    @Test func aTokenThatCannotBeStoredDoesNotSync() async {
        sync.setTokenError = URLError(.unknown)

        await SyncTokenLink(sync: sync).apply(token: "abc123").value

        #expect(sync.syncNowCount == 0)
    }
}
