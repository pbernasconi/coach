import Foundation
import LiftSync
import Testing

@testable import Lift

/// The app side of push (lift/PUSH.md): the tap's hints, the inbox that holds them until the shell attaches, the token
/// as hex, and the APNs host from the provisioning profile.
@MainActor
@Suite struct PushTests {
    @Test func aTapKeepsOnlyStringHintsAndReadsTheLinkAndID() {
        let tap = PushTap(userInfo: [
            "aps": ["alert": ["title": "Run completed!"]],
            "link": "lift://activity/123",
            "notificationId": "7D0C2F0E-2A3B-4C5D-9E8F-0A1B2C3D4E5F",
            "type": "workout.completed",
            "count": 3,
        ])
        #expect(tap.data.keys.sorted() == ["link", "notificationId", "type"])
        #expect(tap.link?.absoluteString == "lift://activity/123")
        #expect(tap.notificationID == "7d0c2f0e-2a3b-4c5d-9e8f-0a1b2c3d4e5f")
        #expect(PushTap(data: ["notificationId": "12"]).notificationID == nil)
        #expect(PushTap(data: [:]).link == nil)
    }

    @Test func theInboxParksATapUntilTheShellAttaches() {
        let inbox = PushInbox()
        let first = PushTap(data: ["link": "lift://today"])
        let second = PushTap(data: ["link": "lift://weigh-in/latest"])
        inbox.tapped(first)
        inbox.tapped(second)  // a newer tap replaces the parked one
        inbox.tokenReceived("ab12")
        var taps: [PushTap] = []
        var tokens: [String] = []
        inbox.attach(onToken: { tokens.append($0) }, onTap: { taps.append($0) })
        #expect(taps == [second])
        #expect(tokens == ["ab12"])
        #expect(inbox.parkedTap == nil)
        inbox.tapped(first)
        inbox.tokenReceived("cd34")
        #expect(taps == [second, first])
        #expect(tokens == ["ab12", "cd34"])
    }

    @Test func aNewShellGetsTheLastToken() {
        let inbox = PushInbox()
        inbox.attach(onToken: { _ in }, onTap: { _ in })
        inbox.tokenReceived("ab12")
        var tokens: [String] = []
        inbox.attach(onToken: { tokens.append($0) }, onTap: { _ in })  // practice mode started the shell over
        #expect(tokens == ["ab12"])
    }

    @Test func theTokenIsLowerCaseHex() {
        #expect(ApnsToken.hex(Data([0x00, 0xAB, 0x10, 0xFF])) == "00ab10ff")
    }

    @Test func theProfileDecidesTheApnsHost() {
        func profile(_ environment: String) -> Data {
            let plist = """
                <?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>Entitlements</key><dict>\
                <key>aps-environment</key><string>\(environment)</string></dict></dict></plist>
                """
            return Data("signature-bytes".utf8) + Data(plist.utf8) + Data("more-signature".utf8)
        }
        typealias Resolver = ApnsEnvironmentResolver
        #expect(Resolver.resolve(provisioningProfile: profile("development"), isDebugBuild: false) == .sandbox)
        #expect(Resolver.resolve(provisioningProfile: profile("production"), isDebugBuild: true) == .production)
        #expect(Resolver.resolve(provisioningProfile: nil, isDebugBuild: true) == .production)
        #expect(Resolver.resolve(provisioningProfile: Data("junk".utf8), isDebugBuild: true) == .sandbox)
        #expect(Resolver.resolve(provisioningProfile: Data("junk".utf8), isDebugBuild: false) == .production)
    }
}
