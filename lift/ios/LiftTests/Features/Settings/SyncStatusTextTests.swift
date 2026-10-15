import Foundation
import LiftSync
import Testing

@testable import Lift

/// The Settings sync status copy.
@Suite struct SyncStatusTextTests {
    let now = Date(timeIntervalSince1970: 1_772_442_000)

    @Test(arguments: [
        (0, "Synced just now"),
        (59, "Synced just now"),
        (120, "Synced 2 min ago"),
        (3_599, "Synced 59 min ago"),
        (3_600, "Synced 1 h ago"),
        (86_399, "Synced 23 h ago"),
    ])
    func lastSyncIsRelativeToNow(secondsAgo: Int, expected: String) {
        let status = SyncStatus(phase: .idle, lastSyncedAt: now.addingTimeInterval(-Double(secondsAgo)))

        #expect(SyncStatusText.describe(status, hasToken: true, now: now) == expected)
    }

    @Test func aDayOrMoreShowsTheDate() {
        let text = SyncStatusText.synced(at: now.addingTimeInterval(-90_000), now: now)

        #expect(text.hasPrefix("Synced "))
        #expect(!text.contains("ago"))
    }

    @Test func aClockThatWentBackReadsAsJustNow() {
        #expect(SyncStatusText.synced(at: now.addingTimeInterval(30), now: now) == "Synced just now")
    }

    @Test func neverSyncedWithAToken() {
        #expect(SyncStatusText.describe(.initial, hasToken: true, now: now) == "Not synced yet")
    }

    @Test func syncingWinsEvenWithoutAToken() {
        let status = SyncStatus(phase: .syncing, lastSyncedAt: nil)

        #expect(SyncStatusText.describe(status, hasToken: false, now: now) == "Syncing…")
    }

    @Test func withoutATokenItIsNotSetUp() {
        let status = SyncStatus(phase: .failed(.unauthorized), lastSyncedAt: now)

        #expect(SyncStatusText.describe(status, hasToken: false, now: now) == "Not set up")
    }

    @Test(arguments: [
        (SyncFailure.notConfigured, "Not set up"),
        (.unauthorized, "Token rejected"),
        (.offline, "Offline"),
        (.rejected(status: 413), "Server refused the sync"),
        (.invalidResponse, "Server reply not recognised"),
        (.storage, "Data on this iPhone could not be read"),
    ])
    func failuresMapToPlainCopy(failure: SyncFailure, expected: String) {
        let status = SyncStatus(phase: .failed(failure), lastSyncedAt: now)

        #expect(SyncStatusText.describe(status, hasToken: true, now: now) == expected)
    }
}
