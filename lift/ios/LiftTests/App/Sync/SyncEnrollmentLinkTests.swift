import Foundation
import LiftSync
import Testing

@testable import Lift

/// A `lift://sync?code=…` link trades its one-time code for the token and syncs; a build that cannot sync ignores it.
@MainActor
@Suite struct SyncEnrollmentLinkTests {
    let sync = FakeSyncing()

    @Test func aValidCodeStoresTheTokenThenSyncs() async {
        sync.enrollmentTokens = ["one-time-code": "made-up-token"]

        await SyncEnrollmentLink(sync: sync).enroll(code: "one-time-code").value

        #expect(sync.savedTokens == ["made-up-token"])
        #expect(sync.syncNowCount == 1)
    }

    @Test func aRefusedCodeDoesNotSync() async {
        await SyncEnrollmentLink(sync: sync).enroll(code: "used-code").value

        #expect(sync.redeemedCodes == ["used-code"])
        #expect(sync.savedTokens.isEmpty)
        #expect(sync.syncNowCount == 0)
    }

    @Test func aBuildWithoutAServerIgnoresTheLink() async {
        sync.isConfigured = false

        await SyncEnrollmentLink(sync: sync).enroll(code: "one-time-code").value

        #expect(sync.redeemedCodes.isEmpty)
        #expect(sync.syncNowCount == 0)
    }
}
