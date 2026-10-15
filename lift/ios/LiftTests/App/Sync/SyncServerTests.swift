import Foundation
import Testing

@testable import Lift

/// Reading the `LiftSyncBaseURL` Info.plist value.
@Suite struct SyncServerTests {
    @Test(arguments: [
        nil, "", "   ", "$(LIFT_SYNC_BASE_URL)", "http://coach.example.com", "https://", "coach.example.com",
    ])
    func anythingButAnHTTPSOriginTurnsSyncOff(value: String?) {
        #expect(SyncServer.baseURL(from: value) == nil)
    }

    @Test func aNumberIsIgnored() {
        #expect(SyncServer.baseURL(from: 42) == nil)
    }

    @Test func anHTTPSOriginIsUsedTrimmed() {
        let url = SyncServer.baseURL(from: "  https://coach.example.com \n")

        #expect(url?.absoluteString == "https://coach.example.com")
    }
}
