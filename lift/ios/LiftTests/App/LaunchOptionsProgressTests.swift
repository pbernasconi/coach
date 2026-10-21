import Foundation
import Testing

@testable import Lift

/// `-open progress`: History opens on its Progress view in demo mode only, and pushes no route.
@Suite struct LaunchOptionsProgressTests {
    @Test func openProgressPicksHistoryOnProgress() {
        let options = LaunchOptions(arguments: ["Lift", "-demo", "-tab", "history", "-open", "progress"])
        #expect(options.opening == .progress)
        #expect(options.opening?.tab == .lift)
        #expect(options.historySegment == .progress)
        #expect(options.initialRoute(upcomingSessionID: nil) == nil)
    }

    @Test func progressNeedsDemoData() {
        #expect(LaunchOptions(arguments: ["Lift", "-open", "progress"]).historySegment == .sessions)
        #expect(LaunchOptions(arguments: ["Lift", "-demo"]).historySegment == .sessions)
    }
}
