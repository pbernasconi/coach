import Foundation
import Testing

@testable import Lift

/// `-open plates`: Plates and bars pushed on Settings, in demo mode only (for screenshots).
@Suite struct LaunchOptionsPlatesTests {
    @Test func openPlatesInDemoModePushesPlatesAndBarsOnSettings() {
        let options = LaunchOptions(arguments: ["Lift", "-demo", "-tab", "settings", "-open", "plates"])
        #expect(options.opening == .plates)
        #expect(options.opening?.tab == .settings)
        #expect(options.initialRoute(upcomingSessionID: nil) == .plates)
    }

    @Test func platesNeedsDemoData() {
        for arguments in [["Lift", "-open", "plates"], ["Lift", "-fresh", "-open", "plates"]] {
            #expect(LaunchOptions(arguments: arguments).initialRoute(upcomingSessionID: nil) == nil)
        }
    }
}
